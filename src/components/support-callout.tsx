import { getSupportUrl } from "@/server/support";

export function SupportCallout({
  placement,
}: {
  placement: "footer" | "roadmap";
}) {
  const supportUrl = getSupportUrl();
  if (!supportUrl) {
    return null;
  }
  const className =
    placement === "roadmap"
      ? "support-callout support-callout-roadmap section-shell"
      : "support-callout support-callout-footer";

  return (
    <aside
      className={className}
      aria-label="Support WallCab"
    >
      <div>
        <p className="eyebrow">Independent project</p>
        <h2>Help keep daily learning wallpapers free.</h2>
      </div>
      <a
        href={supportUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Support WallCab (opens in a new tab)"
      >
        <span>Support WallCab</span>
        <span aria-hidden="true">↗</span>
      </a>
    </aside>
  );
}
