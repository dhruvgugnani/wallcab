import {
  getNextUtcDate,
  toUtcDateKey,
} from "@/features/wallpaper/daily";
import { prepareDailyManifest } from "@/server/daily-manifest";
import { isInternalAuthorized } from "@/server/internal-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET is missing." },
      { status: 503 },
    );
  }

  if (!isInternalAuthorized(request)) {
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
