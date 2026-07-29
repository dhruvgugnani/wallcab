import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-config";

const routes = [
  { path: "", changed: "2026-07-30", frequency: "daily", priority: 1 },
  { path: "/install", changed: "2026-07-30", frequency: "monthly", priority: .9 },
  { path: "/gallery", changed: "2026-07-30", frequency: "daily", priority: .85 },
  { path: "/roadmap", changed: "2026-07-25", frequency: "monthly", priority: .65 },
  { path: "/blog", changed: "2026-07-30", frequency: "weekly", priority: .75 },
  { path: "/blog/build-the-wallcab-shortcut", changed: "2026-07-25", frequency: "monthly", priority: .7 },
  { path: "/blog/one-url-many-wallpapers", changed: "2026-07-24", frequency: "monthly", priority: .65 },
  { path: "/blog/designing-for-the-lock-screen", changed: "2026-07-23", frequency: "monthly", priority: .65 },
  { path: "/blog/why-wallcab-exists", changed: "2026-07-22", frequency: "monthly", priority: .65 },
  { path: "/docs", changed: "2026-07-30", frequency: "monthly", priority: .8 },
  { path: "/docs/api", changed: "2026-07-30", frequency: "monthly", priority: .8 },
  { path: "/docs/architecture", changed: "2026-07-30", frequency: "monthly", priority: .7 },
  { path: "/docs/self-hosting", changed: "2026-07-30", frequency: "monthly", priority: .7 },
  { path: "/docs/contributing", changed: "2026-07-30", frequency: "monthly", priority: .7 },
  { path: "/sources", changed: "2026-07-30", frequency: "monthly", priority: .75 },
  { path: "/privacy", changed: "2026-07-30", frequency: "yearly", priority: .55 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: absoluteUrl(route.path || "/"),
    lastModified: new Date(`${route.changed}T00:00:00.000Z`),
    changeFrequency: route.frequency,
    priority: route.priority,
  }));
}
