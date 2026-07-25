import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-lead">
        <BrandMark />
        <p>
          A useful idea,
          <br />
          once a day.
        </p>
      </div>
      <div className="footer-links">
        <div>
          <p>Explore</p>
          <Link href="/gallery">Gallery</Link>
          <Link href="/roadmap">Roadmap</Link>
          <Link href="/blog">Journal</Link>
        </div>
        <div>
          <p>Build</p>
          <Link href="/docs">Documentation</Link>
          <Link href="/docs/api">API</Link>
          <Link href="/docs/contributing">Contribute</Link>
        </div>
        <div>
          <p>Details</p>
          <Link href="/sources">Sources</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="/rss.xml">RSS</a>
        </div>
      </div>
      <div className="footer-meta">
        <span>© {new Date().getUTCFullYear()} WallCab</span>
        <span>Designed and built by Dhruv Gugnani</span>
        <span>Made for the open web</span>
      </div>
    </footer>
  );
}
