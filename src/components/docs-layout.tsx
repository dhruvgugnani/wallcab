import { DocsNav } from "./docs-nav";

export function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs-shell section-shell">
      <DocsNav />
      <article className="prose">{children}</article>
    </div>
  );
}
