import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "A permanent gallery of WallCab learning wallpaper compositions and today’s live editions.",
  alternates: { canonical: "/gallery" },
};

const showcases = [
  { slug: "vocabulary-nature", category: "Vocabulary", theme: "Nature", term: "LIMINAL" },
  { slug: "coding-amoled", category: "Coding", theme: "AMOLED", term: "IDEMPOTENT" },
  { slug: "finance-minimal", category: "Finance", theme: "Minimal", term: "LIQUIDITY" },
  { slug: "stoicism-mountains", category: "Stoicism", theme: "Mountains", term: "DICHOTOMY" },
  { slug: "science-space", category: "Science", theme: "Space", term: "ENTROPY" },
  { slug: "psychology-abstract", category: "Psychology", theme: "Abstract", term: "PRIMING" },
] as const;

export default function GalleryPage() {
  return (
    <>
      <PageIntro
        eyebrow="The daily archive"
        title="Ideas, held in a frame."
        description="A selection of permanent compositions alongside links to today’s live editions. Every generated image carries its own source credit."
        meta="Six studies / live daily"
      />
      <section className="gallery-grid section-shell" aria-label="Wallpaper gallery">
        {showcases.map((item, index) => (
          <figure key={item.slug} className={index % 3 === 1 ? "gallery-tall" : undefined}>
            <div>
              <Image
                src={`/showcase/${item.slug}.webp`}
                alt={`${item.term}, a ${item.category} wallpaper in the ${item.theme} theme`}
                width={720}
                height={1280}
                sizes="(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw"
              />
            </div>
            <figcaption>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.term}</strong>
              <span>{item.category} / {item.theme}</span>
            </figcaption>
          </figure>
        ))}
      </section>
      <section className="gallery-live section-shell">
        <div>
          <p className="eyebrow">Today, live</p>
          <h2>The current vocabulary edition.</h2>
          <p>
            The live image is generated from today’s external provider data and
            a source-validated photograph.
          </p>
          <a
            className="button button-light"
            href="/api/wallpaper?category=vocabulary&theme=nature&size=standard"
          >
            Open full-resolution PNG
          </a>
        </div>
        <div className="live-phone">
          <Image
            src="/api/wallpaper?category=vocabulary&theme=nature&size=standard"
            alt="Today’s live WallCab vocabulary wallpaper"
            width={1206}
            height={2622}
            sizes="(max-width: 800px) 72vw, 30vw"
            unoptimized
          />
        </div>
      </section>
      <section className="page-cta section-shell">
        <h2>Build an edition of your own.</h2>
        <Link className="button button-light" href="/#make-yours">
          Open configurator
        </Link>
      </section>
    </>
  );
}
