import Link from "next/link";
import { BrandMark } from "./brand-mark";

const navItems = [
  { href: "/gallery", label: "Gallery" },
  { href: "/install", label: "Install" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Journal" },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="WallCab home">
        <BrandMark />
        <span>WallCab</span>
      </Link>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        <Link className="nav-cta" href="/#make-yours">
          Make yours
        </Link>
      </nav>
      <details className="mobile-menu">
        <summary aria-label="Open navigation">
          <span />
          <span />
        </summary>
        <nav aria-label="Mobile navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/#make-yours">Make yours</Link>
        </nav>
      </details>
    </header>
  );
}
