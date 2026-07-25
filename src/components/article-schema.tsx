import { StructuredData } from "./structured-data";

export function ArticleSchema({
  title,
  description,
  date,
  slug,
}: {
  title: string;
  description: string;
  date: string;
  slug: string;
}) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = `${origin}/blog/${slug}`;

  return (
    <StructuredData
      data={[
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description,
          datePublished: date,
          dateModified: date,
          author: { "@type": "Person", name: "Dhruv Gugnani" },
          publisher: { "@type": "Organization", name: "WallCab" },
          mainEntityOfPage: url,
          image: `${origin}/opengraph-image`,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "WallCab",
              item: origin,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Journal",
              item: `${origin}/blog`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: title,
              item: url,
            },
          ],
        },
      ]}
    />
  );
}
