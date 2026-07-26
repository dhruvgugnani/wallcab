import { after } from "next/server";
import {
  devicePresets,
  learningCategories,
  themeCadence,
  visualThemes,
  type DailyLesson,
  type WallpaperPreferences,
} from "@/features/wallpaper/types";
import { parseWallpaperSearchParams } from "@/features/wallpaper/validation";
import { selectDailyCategory } from "@/features/wallpaper/preferences";
import {
  getCachedWallpaperUrl,
  putCacheValue,
} from "@/server/cache/client";
import {
  getNextUtcRollover,
  toUtcDateKey,
} from "@/features/wallpaper/daily";
import {
  getPreparedManifest,
  resolveDailyLesson,
} from "@/server/daily-manifest";
import { checkRateLimit } from "@/server/rate-limit";
import {
  renderWallpaper,
  wallpaperCacheKey,
} from "@/server/wallpaper-renderer";

export const runtime = "nodejs";
export const maxDuration = 30;

function clientKey(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

function rateHeaders(result: ReturnType<typeof checkRateLimit>): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
}

function contentHeaders(
  preferences: WallpaperPreferences,
  lesson: DailyLesson,
): HeadersInit {
  return {
    "X-WallCab-Categories": preferences.categories.join(","),
    "X-WallCab-Category": lesson.category,
    "X-WallCab-Content-Mode": lesson.provenance.mode,
    "X-WallCab-Content-Provider": lesson.provenance.provider,
    "X-WallCab-Background-Mode": preferences.customBackgroundId
      ? "custom"
      : themeCadence[preferences.theme] === "daily"
        ? "daily-photo"
        : "fixed-design",
  };
}

function logWallpaperResponse(
  requestId: string,
  preferences: WallpaperPreferences,
  lesson: DailyLesson,
  cache: "HIT" | "MISS" | "BYPASS",
): void {
  console.info(
    JSON.stringify({
      event: "wallcab.wallpaper",
      requestId,
      date: lesson.date,
      categories: preferences.categories,
      resolvedCategory: lesson.category,
      contentMode: lesson.provenance.mode,
      contentProvider: lesson.provenance.provider,
      fallbackReason: lesson.provenance.fallbackReason,
      backgroundMode: preferences.customBackgroundId
        ? "custom"
        : themeCadence[preferences.theme] === "daily"
          ? "daily-photo"
          : "fixed-design",
      cache,
    }),
  );
}

async function handleWallpaper(
  request: Request,
  includeBody: boolean,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const rateLimit = checkRateLimit(clientKey(request));
  const throttlingHeaders = rateHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return Response.json(
      {
        code: "RATE_LIMITED",
        message: "Too many wallpaper requests. Try again shortly.",
        requestId,
      },
      {
        status: 429,
        headers: {
          ...throttlingHeaders,
          "Retry-After": String(
            Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1_000)),
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
          : "Choose supported categories, a theme, a size, and an optional note of no more than 80 characters.",
        allowed: {
          categories: learningCategories,
          theme: visualThemes,
          size: devicePresets,
        },
        requestId,
      },
      {
        status: 400,
        headers: throttlingHeaders,
      },
    );
  }

  const now = new Date();
  const dateKey = toUtcDateKey(now);
  const category = selectDailyCategory(parsed.value.categories, now);
  const resolvedRequest = {
    category,
    theme: parsed.value.theme,
    size: parsed.value.size,
    customBackgroundId: parsed.value.customBackgroundId,
    personalNote: parsed.value.personalNote,
  };
  const manifest = await getPreparedManifest(dateKey);
  const lesson = await resolveDailyLesson(category, now, manifest);
  const provenanceHeaders = contentHeaders(parsed.value, lesson);
  const key = wallpaperCacheKey(resolvedRequest, dateKey);
  const bypassSharedCache = Boolean(parsed.value.personalNote);
  const cachedUrl = bypassSharedCache
    ? null
    : await getCachedWallpaperUrl(key);

  if (cachedUrl) {
    logWallpaperResponse(
      requestId,
      parsed.value,
      lesson,
      "HIT",
    );
    return new Response(null, {
      status: 307,
      headers: {
        ...throttlingHeaders,
        ...provenanceHeaders,
        Location: cachedUrl,
        "Cache-Control": "private, no-store",
        "X-WallCab-Cache": "HIT",
        "X-WallCab-Date": dateKey,
        "X-WallCab-Size": parsed.value.size,
        "X-WallCab-Theme": parsed.value.theme,
      },
    });
  }

  try {
    const wallpaper = await renderWallpaper(resolvedRequest, now, {
      manifest,
      lesson,
    });
    if (!bypassSharedCache) {
      after(async () => {
        await putCacheValue(
          wallpaper.key,
          wallpaper.bytes,
          "image/png",
          getNextUtcRollover(now),
        );
      });
    }
    const cacheStatus = bypassSharedCache ? "BYPASS" : "MISS";

    const responseHeaders: HeadersInit = {
      ...throttlingHeaders,
      ...provenanceHeaders,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="wallcab-${dateKey}-${wallpaper.category}-${wallpaper.theme}-${wallpaper.size}.png"`,
      "Content-Length": String(wallpaper.byteLength),
      "Content-Type": "image/png",
      ETag: `"${wallpaper.etag}"`,
      Link: '</sources>; rel="describedby"',
      "X-Request-Id": requestId,
      "X-WallCab-Cache": cacheStatus,
      "X-WallCab-Date": dateKey,
      "X-WallCab-Size": wallpaper.size,
      "X-WallCab-Theme": wallpaper.theme,
    };

    const body = includeBody
      ? Uint8Array.from(wallpaper.bytes).buffer
      : null;
    logWallpaperResponse(
      requestId,
      parsed.value,
      lesson,
      cacheStatus,
    );
    return new Response(body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        code: "WALLPAPER_GENERATION_FAILED",
        message: "WallCab could not prepare this wallpaper. Try again shortly.",
        requestId,
      },
      {
        status: 502,
        headers: throttlingHeaders,
      },
    );
  }
}

export function GET(request: Request): Promise<Response> {
  return handleWallpaper(request, true);
}

export function HEAD(request: Request): Promise<Response> {
  return handleWallpaper(request, false);
}
