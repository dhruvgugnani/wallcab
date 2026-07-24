import {
  getNextUtcDate,
  toUtcDateKey,
} from "@/features/wallpaper/daily";
import { safeEqualHex, sha256Hex } from "@/server/cache/signing";
import { prepareDailyManifest } from "@/server/daily-manifest";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  return safeEqualHex(
    sha256Hex(authorization.slice("Bearer ".length)),
    sha256Hex(secret),
  );
}

export async function GET(request: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET is missing." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return Response.json(
      { code: "UNAUTHORIZED", message: "A valid cron secret is required." },
      { status: 401 },
    );
  }

  const date = getNextUtcDate();
  const prepared = await prepareDailyManifest(date);
  return Response.json({
    ok: true,
    date: toUtcDateKey(date),
    stored: prepared.stored,
    categories: Object.keys(prepared.manifest.lessons).length,
    themes: Object.keys(prepared.manifest.backgrounds).length,
  });
}
