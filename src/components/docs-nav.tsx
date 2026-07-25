import Link from "next/link";

const links = [
  { href: "/docs", label: "Start here" },
  { href: "/docs/api", label: "API reference" },
  { href: "/docs/architecture", label: "Architecture" },
  { href: "/docs/self-hosting", label: "Self-hosting" },
  { href: "/docs/contributing", label: "Contributing" },
] as const;

export function DocsNav() {
  return (
    <nav className="docs-nav" aria-label="Documentation">
      <p>Documentation</p>
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
