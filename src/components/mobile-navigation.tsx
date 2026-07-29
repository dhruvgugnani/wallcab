"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GITHUB_URL } from "@/lib/site-config";

const navItems = [
  { href: "/gallery", label: "Gallery" },
  { href: "/install", label: "Install" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Journal" },
] as const;

export function MobileNavigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="mobile-menu">
      <button
        className="mobile-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((current) => !current)}
      >
        <span />
        <span />
      </button>
      <div
        id="mobile-navigation"
        className="mobile-menu-panel"
        hidden={!open}
      >
        <nav aria-label="Mobile navigation">
          {navItems.map((item, index) => (
            <Link key={item.href} href={item.href} onClick={closeMenu}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            onClick={closeMenu}
          >
            <span>05</span>
            GitHub
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
        <Link
          className="mobile-menu-cta"
          href="/#make-yours"
          onClick={closeMenu}
        >
          Make Your WallCab
        </Link>
        <p>One sourced lesson on your Lock Screen, every day.</p>
      </div>
    </div>
  );
}
