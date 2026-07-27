import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import { StructuredData } from "@/components/structured-data";

export const metadata: Metadata = {
  title: "Install",
  description:
    "Follow real iPhone screenshots to set up WallCab as a daily lock-screen automation.",
  alternates: { canonical: "/install" },
};

const steps = [
  {
    number: "01",
    title: "Copy your wallpaper address",
    body: "Use the configurator, choose your learning interests, a built-in style or private custom background, iPhone size, and optional personal note, then copy the API address it creates.",
    art: "url",
  },
  {
    number: "02",
    title: "Start a personal automation",
    body: "Open Shortcuts, tap Automation, tap +, and choose Time of Day.",
    art: "clock",
  },
  {
    number: "03",
    title: "Set it to run daily",
    body: "Choose a morning time, select Daily and Run Immediately, then tap Next.",
    art: "shortcut",
  },
  {
    number: "04",
    title: "Add the download action",
    body: "Create a new shortcut inside the automation, add Get Contents of URL, and paste your WallCab address.",
    art: "url",
  },
  {
    number: "05",
    title: "Set and test the wallpaper",
    body: "Add Set Wallpaper Photo, choose Lock Screen, disable previews and automatic image effects, then run it once.",
    art: "wallpaper",
  },
] as const;

type WalkthroughStep = {
  number: string;
  title: string;
  intro: string;
  instructions: string[];
  note: string;
  image: string;
  alt: string;
  caption: string;
};

const walkthroughSteps: WalkthroughStep[] = [
  {
    number: "01",
    title: "Choose the Time of Day trigger",
    intro:
      "Start in Apple’s Shortcuts app. This creates an automation that can run without you opening WallCab.",
    instructions: [
      "Tap Automation in the bottom navigation.",
      "Tap the + button in the top-right corner. If this is your first automation, tap New Automation instead.",
      "Choose Create Personal Automation if iOS asks which kind you want.",
      "Tap Time of Day.",
    ],
    note:
      "Do not choose Alarm or Sleep. Those triggers depend on a separate alarm or sleep schedule.",
    image: "/install/01-choose-time-of-day.webp",
    alt: "Apple Shortcuts Personal Automation screen with Time of Day at the top",
    caption: "Choose Time of Day from the Personal Automation screen.",
  },
  {
    number: "02",
    title: "Pick the daily schedule",
    intro:
      "Choose when the new wallpaper should appear. A morning time is easiest because the lesson is ready before you begin the day.",
    instructions: [
      "Select Time of Day and choose your preferred hour.",
      "Under Repeat, select Daily.",
      "Scroll down and select Run Immediately.",
      "Leave Notify When Run off if you do not want a daily Shortcuts notification.",
      "Tap Next.",
    ],
    note:
      "The screenshot shows Run After Confirmation selected. Change it to Run Immediately, or WallCab will wait for your approval every day.",
    image: "/install/02-set-daily-schedule.webp",
    alt: "Apple Shortcuts schedule screen showing Time of Day and Daily selected",
    caption:
      "Choose a time and Daily, then scroll down to select Run Immediately.",
  },
  {
    number: "03",
    title: "Add “Get Contents of URL”",
    intro:
      "After the schedule screen, tap Create New Shortcut. The next action will download the PNG from your personal WallCab address.",
    instructions: [
      "Tap the Search Actions field.",
      "Type Get Contents of URL.",
      "Tap the green Get Contents of URL result.",
      "A new action card will appear in the editor.",
    ],
    note:
      "Choose Get Contents of URL—not Open URL. Open URL would launch Safari instead of downloading the wallpaper quietly.",
    image: "/install/03-find-get-contents.webp",
    alt: "Shortcuts action search showing the Get Contents of URL result",
    caption: "Search for and select the green Get Contents of URL action.",
  },
  {
    number: "04",
    title: "Paste your WallCab address",
    intro:
      "This address carries your learning interests, visual style, iPhone size, custom background ID, and optional personal note.",
    instructions: [
      "Tap the blue URL placeholder inside the action.",
      "Paste the complete address copied from the WallCab configurator.",
      "Check that the address begins with https:// and contains /api/wallpaper.",
      "Keep Method set to GET. You do not need headers or a request body.",
    ],
    note:
      "Paste the complete address without deleting anything after the question mark. Those values are what personalize the daily wallpaper.",
    image: "/install/04-paste-wallcab-address.webp",
    alt: "Get Contents of URL action with a WallCab wallpaper API address pasted into it",
    caption:
      "Paste the entire wallpaper address and leave the request method as GET.",
  },
  {
    number: "05",
    title: "Add “Set Wallpaper Photo”",
    intro:
      "The first action downloads the image. This second action tells iOS where to place it.",
    instructions: [
      "Tap Search Actions beneath the first action.",
      "Type Set Wallpaper Photo.",
      "Tap the blue Set Wallpaper Photo result.",
      "If the new action does not automatically use Contents of URL, tap its photo field and choose Contents of URL.",
    ],
    note:
      "The two actions must stay in this order: download the image first, then set it as the wallpaper.",
    image: "/install/05-find-set-wallpaper.webp",
    alt: "Shortcuts action search showing the Set Wallpaper Photo result",
    caption: "Search for and select Set Wallpaper Photo.",
  },
  {
    number: "06",
    title: "Choose the Lock Screen and test it",
    intro:
      "Finish the wallpaper action carefully. These settings prevent daily prompts, unwanted crops, and extra blur.",
    instructions: [
      "Tap the blue wallpaper name and select the Lock Screen you want WallCab to update.",
      "Choose Lock Screen only unless you also want WallCab on your Home Screen.",
      "Turn Show Preview off.",
      "Turn Crop to Subject off.",
      "Turn Legibility Blur off.",
      "Tap the play button once. Allow network and wallpaper permissions if iOS asks.",
      "When the wallpaper changes successfully, tap the blue checkmark to save.",
    ],
    note:
      "Important: Legibility Blur is green in the screenshot. Tap it once so it becomes gray. WallCab already adds its own readability gradient.",
    image: "/install/06-configure-wallpaper.webp",
    alt: "Completed WallCab automation with Get Contents of URL and Set Wallpaper Photo actions",
    caption:
      "Use Lock Screen, disable all three image options, test once, then save.",
  },
];

const troubleshooting = [
  {
    problem: "It asks before running every day",
    fix: "Edit the automation’s schedule and change Run After Confirmation to Run Immediately. Also confirm Show Preview is off in Set Wallpaper Photo.",
  },
  {
    problem: "The wallpaper looks blurred or cropped",
    fix: "Open Set Wallpaper Photo and turn Legibility Blur and Crop to Subject off.",
  },
  {
    problem: "Nothing happens when you test it",
    fix: "Run the automation once inside Shortcuts and accept the network and wallpaper permissions. Then try the play button again.",
  },
  {
    problem: "The wrong learning topic appears",
    fix: "That can be expected. When you select several interests, WallCab chooses one of them for the UTC day and rotates them over time.",
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
        "The URL includes your selected learning interests, visual choice, device size, and any personal note you add. A custom background adds an unguessable image ID, never its deletion secret. Do not put sensitive information in the optional note because it is visible in the URL.",
    },
    {
      question: "What if the download button is unavailable?",
      answer:
        "Use the detailed screenshot guide on this page. It builds the same two-action automation directly in Apple Shortcuts.",
    },
    {
      question: "Why should Legibility Blur be off?",
      answer:
        "WallCab already composes a contrast gradient behind its lesson. Apple’s additional blur can hide the photograph and soften the typography.",
    },
    {
      question: "Can I change my choices later?",
      answer:
        "Yes. Return to the WallCab configurator, make new choices, copy the new address, and replace the URL inside Get Contents of URL.",
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
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "Set up WallCab on an iPhone",
          description:
            "Create a daily Apple Shortcuts automation that downloads and sets a personalized WallCab learning wallpaper.",
          totalTime: "PT10M",
          tool: [{ "@type": "HowToTool", name: "Apple Shortcuts" }],
          step: walkthroughSteps.map((step) => ({
            "@type": "HowToStep",
            name: step.title,
            text: [step.intro, ...step.instructions].join(" "),
            url: `/install#install-step-${step.number}`,
          })),
        }}
      />
      <PageIntro
        eyebrow="Ten-minute setup"
        title="Set it once. Learn every day."
        description="Follow real iPhone screens to build a daily WallCab automation. No app, login, background tracking, or subscription."
        meta="6 illustrated screens · beginner friendly"
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
          Create my wallpaper address
        </Link>
      </section>

      <section
        className="install-overview section-shell"
        aria-labelledby="install-overview-title"
      >
        <p className="eyebrow">The short version</p>
        <div>
          <h2 id="install-overview-title">The complete setup at a glance.</h2>
          <p>
            You will create one personal automation with only two actions:
            download today&apos;s WallCab image, then set it as your Lock
            Screen. The detailed screens below walk through every tap.
          </p>
        </div>
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

      <section
        className="install-guide-intro section-shell"
        aria-labelledby="install-guide-title"
      >
        <p className="eyebrow">Follow the screens</p>
        <div>
          <h2 id="install-guide-title">Build it on your iPhone, tap by tap.</h2>
          <p>
            Apple occasionally changes small labels between iOS versions. If
            one button looks slightly different, follow the action name shown
            in bold. The workflow is still the same.
          </p>
          <div className="install-before">
            <strong>Before opening Shortcuts</strong>
            <ol>
              <li>
                Open the WallCab <Link href="/#make-yours">configurator</Link>.
              </li>
              <li>Choose your interests, style, iPhone, and optional note.</li>
              <li>Tap Copy address and keep it on your clipboard.</li>
            </ol>
          </div>
        </div>
      </section>

      <ol className="install-manual section-shell">
        {walkthroughSteps.map((step) => (
          <li id={`install-step-${step.number}`} key={step.number}>
            <div className="install-manual-copy">
              <span>Screen {step.number} / 06</span>
              <h2>{step.title}</h2>
              <p>{step.intro}</p>
              <ol>
                {step.instructions.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ol>
              <aside className="install-note">
                <strong>Check this</strong>
                <p>{step.note}</p>
              </aside>
            </div>
            <figure className="install-shot">
              <div>
                <Image
                  src={step.image}
                  alt={step.alt}
                  width={900}
                  height={1951}
                  sizes="(max-width: 800px) 86vw, 34vw"
                />
              </div>
              <figcaption>{step.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ol>

      <section
        className="install-finish section-shell"
        aria-labelledby="install-finish-title"
      >
        <p className="eyebrow">Final check</p>
        <div>
          <h2 id="install-finish-title">You are done when these 4 things are true.</h2>
          <ul>
            <li>The automation is enabled and set to Run Immediately.</li>
            <li>Get Contents of URL contains your complete WallCab address.</li>
            <li>Set Wallpaper Photo receives Contents of URL.</li>
            <li>A manual test changes the intended Lock Screen.</li>
          </ul>
        </div>
      </section>

      <section
        className="install-troubleshooting section-shell"
        aria-labelledby="install-troubleshooting-title"
      >
        <p className="eyebrow">If something looks wrong</p>
        <h2 id="install-troubleshooting-title">Quick fixes.</h2>
        <div>
          {troubleshooting.map((item) => (
            <article key={item.problem}>
              <h3>{item.problem}</h3>
              <p>{item.fix}</p>
            </article>
          ))}
        </div>
      </section>

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
