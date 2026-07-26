import { z } from "zod";
import {
  getNextUtcRollover,
  toUtcDateKey,
} from "@/features/wallpaper/daily";
import {
  learningCategories,
  visualThemes,
  type BackgroundAsset,
  type BackgroundAttribution,
  type DailyLesson,
  type LearningCategory,
  type VisualTheme,
} from "@/features/wallpaper/types";
import {
  getPrivateCacheValue,
  putCacheValue,
} from "@/server/cache/client";
import { getBackgroundAsset } from "@/server/services/background-provider";
import { getHybridDailyLesson } from "@/server/services/content-providers";

const attributionSchema = z.object({
  label: z.string(),
  url: z.url(),
  license: z.string(),
  creator: z.string().optional(),
  source: z.string(),
});

const lessonSchema = z.object({
  date: z.string(),
  category: z.enum(learningCategories),
  term: z.string(),
  pronunciation: z.string().max(50).optional(),
  definition: z.string(),
  quote: z.object({ text: z.string(), author: z.string() }),
  fact: z.string(),
  sources: z.array(
    z.object({
      label: z.string(),
      url: z.url(),
      license: z.string(),
      creator: z.string().optional(),
    }),
  ),
  provenance: z.object({
    mode: z.enum(["external", "fallback"]),
    provider: z.string(),
    fallbackReason: z
      .enum([
        "provider_unavailable",
        "provider_timeout",
        "invalid_response",
        "unusable_content",
      ])
      .optional(),
  }),
});

const manifestSchema = z.object({
  version: z.literal(4),
  date: z.string(),
  lessons: z.record(z.enum(learningCategories), lessonSchema),
  backgrounds: z.record(z.enum(visualThemes), attributionSchema),
});

export type DailyManifest = z.infer<typeof manifestSchema>;

export function manifestCacheKey(dateKey: string): string {
  return `manifest/v4/${dateKey}.json`;
}

export function lessonCacheKey(
  dateKey: string,
  category: LearningCategory,
): string {
  return `lesson/v3/${dateKey}/${category}.json`;
}

export function backgroundCacheKey(
  dateKey: string,
  theme: VisualTheme,
): string {
  return `background/v3/${dateKey}/${theme}`;
}

export function backgroundAttributionCacheKey(
  dateKey: string,
  theme: VisualTheme,
): string {
  return `background-attribution/v3/${dateKey}/${theme}.json`;
}

export async function getPreparedManifest(
  dateKey: string,
): Promise<DailyManifest | null> {
  const response = await getPrivateCacheValue(manifestCacheKey(dateKey));
  if (!response) {
    return null;
  }

  try {
    return manifestSchema.parse(await response.json());
  } catch {
    return null;
  }
}

export async function getCachedDailyLesson(
  category: LearningCategory,
  dateKey: string,
): Promise<DailyLesson | null> {
  const response = await getPrivateCacheValue(
    lessonCacheKey(dateKey, category),
  );
  if (!response) {
    return null;
  }

  try {
    return lessonSchema.parse(await response.json());
  } catch {
    return null;
  }
}

async function storeDailyLesson(
  lesson: DailyLesson,
  expiration: number,
): Promise<boolean> {
  return putCacheValue(
    lessonCacheKey(lesson.date, lesson.category),
    new TextEncoder().encode(JSON.stringify(lesson)),
    "application/json",
    expiration,
  );
}

function storeDailyBackground(
  dateKey: string,
  theme: VisualTheme,
  asset: BackgroundAsset,
  expiration: number,
): [Promise<boolean>, Promise<boolean>] {
  return [
    putCacheValue(
      backgroundCacheKey(dateKey, theme),
      asset.bytes,
      asset.contentType,
      expiration,
    ),
    putCacheValue(
      backgroundAttributionCacheKey(dateKey, theme),
      new TextEncoder().encode(JSON.stringify(asset.attribution)),
      "application/json",
      expiration,
    ),
  ];
}

export async function prepareDailyManifest(
  date: Date,
): Promise<{ manifest: DailyManifest; stored: boolean }> {
  const dateKey = toUtcDateKey(date);
  const [lessonEntries, backgroundEntries] = await Promise.all([
    Promise.all(
      learningCategories.map(async (category) => {
        const lesson = await getHybridDailyLesson(category, date);
        return [category, lesson] as const;
      }),
    ),
    Promise.all(
      visualThemes.map(async (theme) => {
        const background = await getBackgroundAsset(theme, date);
        return [theme, background] as const;
      }),
    ),
  ]);

  const lessons = Object.fromEntries(lessonEntries) as Record<
    LearningCategory,
    DailyLesson
  >;
  const backgrounds = Object.fromEntries(
    backgroundEntries.map(([theme, asset]) => [theme, asset.attribution]),
  ) as Record<VisualTheme, BackgroundAttribution>;
  const manifest: DailyManifest = {
    version: 4,
    date: dateKey,
    lessons,
    backgrounds,
  };
  const expiration = getNextUtcRollover(date);
  const backgroundWrites = backgroundEntries.flatMap(([theme, asset]) =>
    storeDailyBackground(dateKey, theme, asset, expiration),
  );
  const lessonWrites = lessonEntries.map(([, lesson]) =>
    storeDailyLesson(lesson, expiration),
  );
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const results = await Promise.all([
    ...backgroundWrites,
    ...lessonWrites,
    putCacheValue(
      manifestCacheKey(dateKey),
      manifestBytes,
      "application/json",
      expiration,
    ),
  ]);

  return {
    manifest,
    stored: results.every(Boolean),
  };
}

export async function resolveDailyLesson(
  category: LearningCategory,
  date: Date,
  manifest: DailyManifest | null,
): Promise<DailyLesson> {
  const prepared = manifest?.lessons[category];
  if (prepared) {
    return prepared;
  }

  const dateKey = toUtcDateKey(date);
  const cached = await getCachedDailyLesson(category, dateKey);
  if (cached) {
    return cached;
  }

  const lesson = await getHybridDailyLesson(category, date);
  await storeDailyLesson(lesson, getNextUtcRollover(date));
  return lesson;
}

export async function resolveBackground(
  theme: VisualTheme,
  date: Date,
  manifest: DailyManifest | null,
): Promise<BackgroundAsset> {
  const dateKey = toUtcDateKey(date);
  let attribution = manifest?.backgrounds[theme];

  if (!attribution) {
    const attributionResponse = await getPrivateCacheValue(
      backgroundAttributionCacheKey(dateKey, theme),
    );
    if (attributionResponse) {
      try {
        attribution = attributionSchema.parse(
          await attributionResponse.json(),
        );
      } catch {
        attribution = undefined;
      }
    }
  }

  if (attribution) {
    const response = await getPrivateCacheValue(
      backgroundCacheKey(dateKey, theme),
    );
    const contentType = response?.headers.get("content-type");

    if (
      response &&
      (contentType === "image/jpeg" || contentType === "image/svg+xml")
    ) {
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType,
        attribution,
      };
    }
  }

  const asset = await getBackgroundAsset(theme, date);
  await Promise.all(
    storeDailyBackground(
      dateKey,
      theme,
      asset,
      getNextUtcRollover(date),
    ),
  );
  return asset;
}
