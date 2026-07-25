import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Notes on making learning calmer, wallpaper composition, Shortcuts, and WallCab’s architecture.",
  alternates: { canonical: "/blog" },
};

const posts = [
  {
    slug: "build-the-wallcab-shortcut",
    number: "01",
    title: "Build the WallCab Shortcut by hand",
    description:
      "A transparent five-minute setup—and why a plain URL is the best interface.",
    date: "July 25, 2026",
    tag: "Guide",
  },
  {
    slug: "one-url-many-wallpapers",
    number: "02",
    title: "One URL, 192 possible wallpapers",
    description:
      "Inside the small API, deterministic content system, and edge cache behind WallCab.",
    date: "July 24, 2026",
    tag: "Engineering",
  },
  {
    slug: "designing-for-the-lock-screen",
    number: "03",
    title: "Designing for the quietest screen",
    description:
      "Safe zones, type fitting, contrast, credits, and the odd constraints of a lock screen.",
    date: "July 23, 2026",
    tag: "Design",
  },
  {
    slug: "why-wallcab-exists",
    number: "04",
    title: "Why WallCab exists",
    description:
      "A case for learning products that ask less of your attention, not more.",
    date: "July 22, 2026",
    tag: "Field note",
  },
] as const;

export default function BlogPage() {
  return (
    <>
      <PageIntro
        eyebrow="The journal"
        title="Notes from the cabinet."
        description="Design decisions, technical field notes, and practical guides from building a quieter learning tool."
        meta="Written by Dhruv Gugnani"
      />
      <ol className="journal-list section-shell">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>
              <span>{post.number}</span>
              <div>
                <p>{post.tag} / {post.date}</p>
                <h2>{post.title}</h2>
                <p>{post.description}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
