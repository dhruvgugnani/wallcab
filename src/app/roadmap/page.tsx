import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What WallCab is building now, next, and later.",
  alternates: { canonical: "/roadmap" },
};

const roadmap = [
  {
    state: "Now",
    title: "MVP foundation",
    items: [
      "Eight external-first learning feeds",
      "Five daily photo themes and six fixed SVG originals",
      "Three current iPhone canvases",
      "Universal Apple Shortcut setup",
      "Public wallpaper API and source manifest",
    ],
  },
  {
    state: "Next",
    title: "A more expressive cabinet",
    items: [
      "More language and programming tracks",
      "Additional typographic compositions",
      "Community-reviewed lesson contributions",
      "More device-safe presets",
      "Provider health and status page",
    ],
  },
  {
    state: "Later",
    title: "Portable and self-owned",
    items: [
      "Docker-based self-hosting bundle",
      "Android automation guide",
      "Custom lesson feeds",
      "Localization and right-to-left layouts",
      "Opt-in personal archives",
    ],
  },
] as const;

export default function RoadmapPage() {
  return (
    <>
      <PageIntro
        eyebrow="Open roadmap"
        title="Useful first. Expansive later."
        description="WallCab begins with a small, dependable daily ritual. These are directions, not promises; reliability and source quality come before feature count."
        meta="Last reviewed July 2026"
      />
      <section className="roadmap section-shell">
        {roadmap.map((column, index) => (
          <article key={column.state}>
            <span>0{index + 1}</span>
            <p className="eyebrow">{column.state}</p>
            <h2>{column.title}</h2>
            <ul>
              {column.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </>
  );
}
