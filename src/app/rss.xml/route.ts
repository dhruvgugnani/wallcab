const posts = [
  {
    slug: "build-the-wallcab-shortcut",
    title: "Build the WallCab Shortcut by hand",
    description: "A transparent five-minute Apple Shortcuts setup for WallCab.",
    date: "2026-07-25T00:00:00.000Z",
  },
  {
    slug: "one-url-many-wallpapers",
    title: "One URL, 264 possible wallpapers",
    description:
      "Inside WallCab’s deterministic content, rendering, and edge cache architecture.",
    date: "2026-07-24T00:00:00.000Z",
  },
  {
    slug: "designing-for-the-lock-screen",
    title: "Designing for the quietest screen",
    description:
      "How WallCab composes legible, credited learning wallpapers.",
    date: "2026-07-23T00:00:00.000Z",
  },
  {
    slug: "why-wallcab-exists",
    title: "Why WallCab exists",
    description: "A case for learning products that ask for less attention.",
    date: "2026-07-22T00:00:00.000Z",
  },
] as const;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items = posts
    .map(
      (post) => `<item>
  <title>${escapeXml(post.title)}</title>
  <link>${origin}/blog/${post.slug}</link>
  <guid isPermaLink="true">${origin}/blog/${post.slug}</guid>
  <pubDate>${new Date(post.date).toUTCString()}</pubDate>
  <description>${escapeXml(post.description)}</description>
</item>`,
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>WallCab Journal</title>
  <link>${origin}/blog</link>
  <description>Notes on quieter learning, wallpaper design, and the WallCab system.</description>
  <language>en</language>
  <lastBuildDate>${new Date(posts[0].date).toUTCString()}</lastBuildDate>
  ${items}
</channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
