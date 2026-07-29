import { StructuredData } from "./structured-data";
import { GITHUB_URL, SITE_URL } from "@/lib/site-config";

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
  const url = `${SITE_URL}/blog/${slug}`;

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
          inLanguage: "en",
          author: {
            "@type": "Person",
            name: "Dhruv Gugnani",
            url: GITHUB_URL,
          },
          publisher: {
            "@type": "Organization",
            name: "WallCab",
            url: SITE_URL,
            logo: {
              "@type": "ImageObject",
              url: `${SITE_URL}/icon.svg`,
            },
          },
          mainEntityOfPage: url,
          image: `${SITE_URL}/opengraph-image`,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "WallCab",
              item: SITE_URL,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Journal",
              item: `${SITE_URL}/blog`,
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
