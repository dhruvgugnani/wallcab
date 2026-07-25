import { after } from "next/server";
import {
  devicePresets,
  learningCategories,
  visualThemes,
  type WallpaperRequest,
} from "@/features/wallpaper/types";
import { wallpaperQuerySchema } from "@/features/wallpaper/validation";
import {
  getCachedWallpaperUrl,
  putCacheValue,
} from "@/server/cache/client";
import {
  getNextUtcRollover,
  toUtcDateKey,
} from "@/features/wallpaper/daily";
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

function parseRequest(request: Request):
  | { success: true; value: WallpaperRequest }
  | { success: false } {
  const url = new URL(request.url);
  const parsed = wallpaperQuerySchema.safeParse({
    category: url.searchParams.get("category") ?? undefined,
    theme: url.searchParams.get("theme") ?? undefined,
    size: url.searchParams.get("size") ?? undefined,
  });

  return parsed.success
    ? { success: true, value: parsed.data }
    : { success: false };
}

function rateHeaders(result: ReturnType<typeof checkRateLimit>): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
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

  const parsed = parseRequest(request);
  if (!parsed.success) {
    return Response.json(
      {
        code: "INVALID_WALLPAPER_OPTIONS",
        message: "Choose a supported category, theme, and size.",
        allowed: {
          category: learningCategories,
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
  const key = wallpaperCacheKey(parsed.value, dateKey);
  const cachedUrl = await getCachedWallpaperUrl(key);

  if (cachedUrl) {
    return new Response(null, {
      status: 307,
      headers: {
        ...throttlingHeaders,
        Location: cachedUrl,
        "Cache-Control": "private, no-store",
        "X-WallCab-Cache": "HIT",
      },
    });
  }

  try {
    const wallpaper = await renderWallpaper(parsed.value, now);
    after(async () => {
      await putCacheValue(
        wallpaper.key,
        wallpaper.bytes,
        "image/png",
        getNextUtcRollover(now),
      );
    });

    const responseHeaders: HeadersInit = {
      ...throttlingHeaders,
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "Content-Disposition": `inline; filename="wallcab-${dateKey}-${wallpaper.category}-${wallpaper.theme}-${wallpaper.size}.png"`,
      "Content-Length": String(wallpaper.byteLength),
      "Content-Type": "image/png",
      ETag: `"${wallpaper.etag}"`,
      Link: '</sources>; rel="describedby"',
      "X-Request-Id": requestId,
      "X-WallCab-Cache": "MISS",
      "X-WallCab-Category": wallpaper.category,
      "X-WallCab-Date": dateKey,
      "X-WallCab-Size": wallpaper.size,
      "X-WallCab-Theme": wallpaper.theme,
    };

    const body = includeBody
      ? Uint8Array.from(wallpaper.bytes).buffer
      : null;
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
