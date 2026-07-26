import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Configurator } from "@/features/configurator/configurator";
import { StructuredData } from "@/components/structured-data";
import { categoryLabels, learningCategories } from "@/features/wallpaper/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const turnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const homeSchemas = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "WallCab",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    founder: { "@type": "Person", name: "Dhruv Gugnani" },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "WallCab",
    applicationCategory: "EducationalApplication",
    operatingSystem: "iOS",
    url: siteUrl,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description:
      "A free daily learning wallpaper service for iPhone and Apple Shortcuts.",
  },
];

export default function Home() {
  return (
    <>
      <StructuredData data={homeSchemas} />
      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-kicker">
          <span>Daily learning wallpapers</span>
          <span aria-hidden="true">UTC / 01</span>
        </div>
        <h1 id="hero-title">
          Turn the glance
          <br />
          <em>into a lesson.</em>
        </h1>
        <div className="hero-footer">
          <p>
            One useful idea. One considered image. Delivered to your iPhone
            lock screen every day.
          </p>
          <a className="hero-cta" href="#make-yours">
            <span>Make yours</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v15M6 13l6 6 6-6" />
            </svg>
          </a>
        </div>
        <div className="hero-cabinet" aria-hidden="true">
          <span className="hero-cabinet-orbit" />
          <BrandMark variant="cabinet" />
          <span className="hero-cabinet-monogram">W / C</span>
          <span className="hero-cabinet-status">
            <i />
            Daily edition
          </span>
          <span className="hero-cabinet-time">00:00 UTC</span>
        </div>
      </section>

      <section className="manifesto section-shell" aria-labelledby="manifesto-title">
        <p className="eyebrow">Built for the in-between moments</p>
        <h2 id="manifesto-title">
          Your phone already has your attention.
          <span> WallCab gives a little of it back.</span>
        </h2>
        <div className="manifesto-grid">
          <p>
            No feed to refresh. No streak to protect. A single, source-tracked
            concept arrives quietly and stays with you for the day.
          </p>
          <dl>
            <div>
              <dt>08</dt>
              <dd>learning paths</dd>
            </div>
            <div>
              <dt>11</dt>
              <dd>visual directions</dd>
            </div>
            <div>
              <dt>00</dt>
              <dd>accounts required</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="make-yours" className="configurator-section section-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Build your daily edition</p>
            <h2>A small ritual, set once.</h2>
          </div>
          <p>
            Choose one interest or several, decide how it should feel, and pick
            the iPhone it should fit. Your choices stay in this browser.
          </p>
        </div>
        <Configurator
          siteOrigin={siteUrl}
          turnstileSiteKey={turnstileSiteKey}
        />
      </section>

      <section className="index-section section-shell" aria-labelledby="paths-title">
        <div className="index-heading">
          <p className="eyebrow">The learning cabinet</p>
          <h2 id="paths-title">Eight shelves.<br />A lifetime of ideas.</h2>
        </div>
        <ol className="category-index">
          {learningCategories.map((category, index) => (
            <li key={category}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{categoryLabels[category]}</strong>
              <span>Daily edition</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="process section-shell" aria-labelledby="process-title">
        <div className="process-art" aria-hidden="true">
          <div className="process-phone">
            <span>09:41</span>
            <strong>MORPHOSIS</strong>
            <p>the manner in which an organism changes form</p>
          </div>
        </div>
        <div className="process-copy">
          <p className="eyebrow">Automatic by design</p>
          <h2 id="process-title">Wake up to something worth knowing.</h2>
          <ol>
            <li><span>01</span><p>WallCab selects and validates a sourced lesson.</p></li>
            <li><span>02</span><p>It composes a wallpaper for your exact screen.</p></li>
            <li><span>03</span><p>Apple Shortcuts sets it, without opening an app.</p></li>
          </ol>
          <Link className="text-link" href="/install">
            See the five-minute setup <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section className="closing-cta section-shell">
        <p>One day. One idea.</p>
        <h2>Make your wall<br /><em>mean something.</em></h2>
        <Link className="button button-light" href="#make-yours">
          Create my WallCab
        </Link>
      </section>
    </>
  );
}
