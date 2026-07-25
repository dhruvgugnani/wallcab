import {
  devicePresets,
  learningCategories,
  themeCadence,
  visualThemes,
} from "@/features/wallpaper/types";
import { selectDailyCategory } from "@/features/wallpaper/preferences";
import { parseWallpaperSearchParams } from "@/features/wallpaper/validation";
import { toUtcDateKey } from "@/features/wallpaper/daily";
import { checkRateLimit } from "@/server/rate-limit";
import {
  getPreparedManifest,
  resolveDailyLesson,
} from "@/server/daily-manifest";

export const runtime = "nodejs";
export const maxDuration = 15;

function clientKey(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const rateLimit = checkRateLimit(`status:${clientKey(request)}`);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        code: "RATE_LIMITED",
        message: "Too many status requests. Try again shortly.",
        requestId,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(
              1,
              rateLimit.resetAt - Math.floor(Date.now() / 1_000),
            ),
          ),
        },
      },
    );
  }

  const parsed = parseWallpaperSearchParams(new URL(request.url).searchParams);
  if (!parsed.success) {
    return Response.json(
      {
        code: "INVALID_WALLPAPER_OPTIONS",
        message: parsed.legacyCategory
          ? "The category parameter was replaced. Use categories=vocabulary,coding instead."
          : "Choose between one and eight supported categories, a theme, and a size.",
        allowed: {
          categories: learningCategories,
          theme: visualThemes,
          size: devicePresets,
        },
        requestId,
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const date = toUtcDateKey(now);
  const resolvedCategory = selectDailyCategory(
    parsed.value.categories,
    now,
  );
  const manifest = await getPreparedManifest(date);
  const lesson = await resolveDailyLesson(
    resolvedCategory,
    now,
    manifest,
  );
  const source = lesson.sources[0];

  return Response.json(
    {
      date,
      selectedCategories: parsed.value.categories,
      resolvedCategory,
      content: {
        mode: lesson.provenance.mode,
        provider: lesson.provenance.provider,
        fallbackReason: lesson.provenance.fallbackReason,
        source: source
          ? {
              label: source.label,
              url: source.url,
              license: source.license,
            }
          : null,
      },
      background: {
        mode: parsed.value.customBackgroundId
          ? "custom"
          : themeCadence[parsed.value.theme] === "daily"
            ? "daily-photo"
            : "fixed-design",
        theme: parsed.value.theme,
      },
      requestId,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-WallCab-Category": resolvedCategory,
        "X-WallCab-Content-Mode": lesson.provenance.mode,
        "X-WallCab-Content-Provider": lesson.provenance.provider,
        "X-WallCab-Date": date,
      },
    },
  );
}
