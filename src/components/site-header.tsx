import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { MobileNavigation } from "./mobile-navigation";
import { GITHUB_URL } from "@/lib/site-config";

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
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub <span aria-hidden="true">↗</span>
        </a>
        <Link className="nav-cta" href="/#make-yours">
          Make yours
        </Link>
      </nav>
      <MobileNavigation />
    </header>
  );
}
