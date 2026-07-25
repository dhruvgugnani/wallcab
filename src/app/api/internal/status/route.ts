import { learningCategories } from "@/features/wallpaper/types";
import { toUtcDateKey } from "@/features/wallpaper/daily";
import {
  getCachedDailyLesson,
  getPreparedManifest,
} from "@/server/daily-manifest";
import { isInternalAuthorized } from "@/server/internal-auth";

export const runtime = "nodejs";
export const maxDuration = 15;

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

  const date = toUtcDateKey();
  const manifest = await getPreparedManifest(date);
  const categories = await Promise.all(
    learningCategories.map(async (category) => {
      const lesson =
        manifest?.lessons[category] ??
        (await getCachedDailyLesson(category, date));

      return {
        category,
        status: lesson ? "ready" : "not_generated",
        term: lesson?.term,
        mode: lesson?.provenance.mode,
        provider: lesson?.provenance.provider,
        fallbackReason: lesson?.provenance.fallbackReason,
        source: lesson?.sources[0]?.url,
      };
    }),
  );

  return Response.json(
    {
      date,
      preparedManifest: Boolean(manifest),
      categories,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
