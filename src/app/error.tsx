"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="error-page section-shell">
      <p className="eyebrow">Something moved</p>
      <h1>This shelf won’t open.</h1>
      <p>
        WallCab hit an unexpected problem. Your saved choices are still in this
        browser.
      </p>
      <button className="button button-light" type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
