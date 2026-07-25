import Link from "next/link";

export default function NotFound() {
  return (
    <section className="error-page section-shell">
      <p className="eyebrow">404 / Empty shelf</p>
      <h1>There’s nothing framed here.</h1>
      <p>The page may have moved, or perhaps it never made it into the cabinet.</p>
      <Link className="button button-light" href="/">
        Return home
      </Link>
    </section>
  );
}
