import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Privacy",
  description: "WallCab’s deliberately small data footprint.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageIntro
        eyebrow="Privacy"
        title="Nothing personal is required."
        description="WallCab is designed to work without an account, profile, database, advertising identifier, or cross-device tracking."
        meta="Effective July 26, 2026"
      />
      <article className="legal prose section-shell">
        <h2>What stays on your device</h2>
        <p>
          Your learning interests, theme, device selection, and optional
          custom-background deletion credential are saved in your browser’s
          localStorage. WallCab does not send them to a profile service or
          connect them to an identity. Clearing site data removes the local
          copy, so save a separate deletion link before clearing it.
        </p>

        <h2>Optional custom backgrounds</h2>
        <p>
          If you choose to upload an image, your browser first resizes it.
          WallCab validates the file, removes embedded metadata, and stores a
          normalized copy in private Cloudflare Workers KV. The image is used
          only to generate wallpapers requested with its unguessable ID; there
          is no public raw-image address.
        </p>
        <p>
          Cloudflare Turnstile processes an anti-bot challenge before upload.
          WallCab receives its verification token and normal request metadata.
          The upload is automatically removed after 30 days without a
          wallpaper read. You can delete it sooner with the private link shown
          after upload. Keep that link secret: anyone who has it can delete the
          image.
        </p>

        <h2>What a wallpaper request contains</h2>
        <p>
          The wallpaper API receives the preference values embedded in the URL,
          standard request metadata such as an IP address and user agent, and
          the request time. Hosting infrastructure may retain short-lived
          security and operational logs. WallCab does not build user histories
          from them.
        </p>

        <h2>Optional privacy-first analytics</h2>
        <p>
          A production deployment may enable Cloudflare Web Analytics to
          understand aggregate page traffic. It uses no cookies and WallCab
          sends no custom personal identifiers. The analytics script is absent
          when no public analytics token is configured.
        </p>

        <h2>Third-party requests</h2>
        <p>
          WallCab’s server—not your browser—may request learning material from
          Wikimedia, Datamuse, and Free Dictionary, and imagery from Openverse
          and its original media host. The generated wallpaper displays source
          and license credit.
        </p>

        <h2>Contact</h2>
        <p>
          For a privacy question or deletion request concerning operational
          logs, open a privacy-labeled issue in the project’s GitHub repository.
        </p>
      </article>
    </>
  );
}
