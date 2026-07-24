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
});

const manifestSchema = z.object({
  version: z.literal(1),
  date: z.string(),
  lessons: z.record(z.enum(learningCategories), lessonSchema),
  backgrounds: z.record(z.enum(visualThemes), attributionSchema),
});

export type DailyManifest = z.infer<typeof manifestSchema>;

export function manifestCacheKey(dateKey: string): string {
  return `manifest/v1/${dateKey}.json`;
}

export function backgroundCacheKey(
  dateKey: string,
  theme: VisualTheme,
): string {
  return `background/v1/${dateKey}/${theme}`;
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
    version: 1,
    date: dateKey,
    lessons,
    backgrounds,
  };
  const expiration = getNextUtcRollover(date);
  const backgroundWrites = backgroundEntries.map(([theme, asset]) =>
    putCacheValue(
      backgroundCacheKey(dateKey, theme),
      asset.bytes,
      asset.contentType,
      expiration,
    ),
  );
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const results = await Promise.all([
    ...backgroundWrites,
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
  return prepared ?? getHybridDailyLesson(category, date);
}

export async function resolveBackground(
  theme: VisualTheme,
  date: Date,
  manifest: DailyManifest | null,
): Promise<BackgroundAsset> {
  const dateKey = toUtcDateKey(date);
  const attribution = manifest?.backgrounds[theme];

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

  return getBackgroundAsset(theme, date);
}
