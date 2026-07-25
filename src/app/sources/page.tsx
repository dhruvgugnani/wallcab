import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Sources and licenses",
  description:
    "How WallCab sources, validates, credits, and licenses lessons and imagery.",
  alternates: { canonical: "/sources" },
};

const providers = [
  {
    name: "Datamuse",
    use: "Daily vocabulary term discovery",
    license: "Provider terms",
    href: "https://www.datamuse.com/api/",
  },
  {
    name: "Free Dictionary API",
    use: "Vocabulary definitions and pronunciation metadata",
    license: "Provider and upstream dictionary licenses",
    href: "https://dictionaryapi.dev/",
  },
  {
    name: "Wikimedia",
    use: "Concept discovery, summaries, and source links",
    license: "Per-page Wikimedia license",
    href: "https://www.mediawiki.org/wiki/API:REST_API",
  },
  {
    name: "Openverse",
    use: "Discovery of CC0 and public-domain photography",
    license: "CC0 or public domain only",
    href: "https://openverse.org/",
  },
] as const;

export default function SourcesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Provenance"
        title="Every idea has a trail."
        description="WallCab treats attribution as part of the composition, not fine print. Every wallpaper carries a compact credit and every source retains its own license."
        meta="Content ≠ code license"
      />
      <section className="source-table section-shell">
        <div className="source-row source-head">
          <span>Provider</span>
          <span>Used for</span>
          <span>Rights</span>
          <span>Reference</span>
        </div>
        {providers.map((provider) => (
          <div className="source-row" key={provider.name}>
            <strong>{provider.name}</strong>
            <span>{provider.use}</span>
            <span>{provider.license}</span>
            <a href={provider.href} rel="noreferrer">
              Visit source ↗
            </a>
          </div>
        ))}
      </section>
      <article className="legal prose section-shell">
        <h2>Provider-first, reviewed fallback</h2>
        <p>
          WallCab first asks an external provider for the day’s word or concept.
          It validates length, language, duplication risk, source availability,
          and whether the content can fit the wallpaper. A 240-item reviewed
          catalog exists only so a provider outage never leaves the Shortcut
          without a safe image.
        </p>
        <h2>Image selection</h2>
        <p>
          Openverse searches are restricted to CC0 and public-domain material
          with mature content disabled. WallCab verifies the final image host,
          media type, dimensions, byte size, and attribution metadata before
          rendering. A bundled procedural composition is the last resort for
          each theme.
        </p>
        <h2>Licensing boundary</h2>
        <p>
          WallCab source code is available under the MIT License. Lesson text,
          quotations, photographs, provider data, typefaces, and other
          third-party material retain their original licenses. The repository’s
          license does not relicense those works.
        </p>
      </article>
    </>
  );
}
