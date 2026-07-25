import type { MetadataRoute } from "next";

const routes = [
  "",
  "/install",
  "/gallery",
  "/roadmap",
  "/blog",
  "/blog/build-the-wallcab-shortcut",
  "/blog/one-url-many-wallpapers",
  "/blog/designing-for-the-lock-screen",
  "/blog/why-wallcab-exists",
  "/docs",
  "/docs/api",
  "/docs/architecture",
  "/docs/self-hosting",
  "/docs/contributing",
  "/sources",
  "/privacy",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const lastModified = new Date("2026-07-25T00:00:00.000Z");

  return routes.map((route) => ({
    url: `${origin}${route}`,
    lastModified,
    changeFrequency:
      route === "" || route === "/gallery" ? "daily" : "monthly",
    priority: route === "" ? 1 : route.startsWith("/blog/") ? 0.65 : 0.8,
  }));
}
