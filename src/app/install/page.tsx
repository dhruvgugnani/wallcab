import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import { StructuredData } from "@/components/structured-data";

export const metadata: Metadata = {
  title: "Install",
  description:
    "Set up WallCab on iPhone with a simple Apple Shortcut and daily automation.",
  alternates: { canonical: "/install" },
};

const steps = [
  {
    number: "01",
    title: "Copy your wallpaper address",
    body: "Use the configurator, make your three choices, then copy the personal API address it creates.",
    art: "url",
  },
  {
    number: "02",
    title: "Create a new Shortcut",
    body: "Open Shortcuts, tap +, name it WallCab Daily, then add the Get Contents of URL action.",
    art: "shortcut",
  },
  {
    number: "03",
    title: "Paste the address",
    body: "Paste your WallCab address into the URL field. Keep the request method set to GET.",
    art: "paste",
  },
  {
    number: "04",
    title: "Set the wallpaper",
    body: "Add Set Wallpaper Photo, choose Lock Screen, turn Show Preview off, and save the Shortcut.",
    art: "wallpaper",
  },
  {
    number: "05",
    title: "Automate it daily",
    body: "In Automation, choose Time of Day, select a time after 00:05 UTC, run immediately, and choose WallCab Daily.",
    art: "clock",
  },
] as const;

export default function InstallPage() {
  const shortcutUrl = process.env.NEXT_PUBLIC_SHORTCUT_URL;
  const faq = [
    {
      question: "Does WallCab need an app?",
      answer:
        "No. A standard Apple Shortcut downloads and sets the image automatically.",
    },
    {
      question: "Does the Shortcut expose my personal data?",
      answer:
        "No. The URL includes only your learning category, visual theme, and device size.",
    },
    {
      question: "What if the download button is unavailable?",
      answer:
        "Build the Shortcut manually with the illustrated five-step guide on this page.",
    },
  ];

  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      <PageIntro
        eyebrow="Five-minute setup"
        title="Set it once. Learn every day."
        description="WallCab works through Apple Shortcuts. No app, login, background tracking, or subscription."
        meta="Requires iOS Shortcuts"
      />

      <section className="install-actions section-shell">
        {shortcutUrl ? (
          <a className="button button-light" href={shortcutUrl}>
            Get the WallCab Shortcut
          </a>
        ) : (
          <span className="button button-disabled" aria-disabled="true">
            Shortcut download coming soon
          </span>
        )}
        <Link className="text-link" href="/#make-yours">
          First, choose your edition
        </Link>
      </section>

      <ol className="install-steps section-shell">
        {steps.map((step) => (
          <li key={step.number}>
            <div className={`shortcut-illustration art-${step.art}`} aria-hidden="true">
              <div className="shortcut-screen">
                <span>{step.number}</span>
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="step-copy">
              <span>{step.number} / 05</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="faq section-shell" aria-labelledby="faq-title">
        <p className="eyebrow">Good to know</p>
        <h2 id="faq-title">Before you automate.</h2>
        <div>
          {faq.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
