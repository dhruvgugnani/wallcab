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
        meta="Effective August 3, 2026"
      />
      <article className="legal prose section-shell">
        <h2>What stays on your device</h2>
        <p>
          Your learning interests, theme, device selection, optional personal
          note, and custom-background deletion credential are saved in your
          browser’s localStorage. WallCab does not send them to a profile
          service or connect them to an identity. Clearing site data removes
          the local copy, so save a separate deletion link before clearing it.
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
        <p>
          If you add a personal note, it is included in the copied wallpaper
          URL so the renderer can place it on the image. Do not enter sensitive
          information: URL query values may be visible in browser history,
          Shortcut configuration, and hosting request logs. WallCab does not
          include the note in its structured application log or store the
          completed personalized PNG in the shared Worker image cache.
        </p>

        <h2>Anonymous wallpaper-run counters</h2>
        <p>
          WallCab counts valid wallpaper image requests so the maintainer can
          understand whether daily automations are running. Website previews,
          source-status checks, HEAD requests, invalid requests, and internal
          jobs are excluded.
        </p>
        <p>
          Each accepted event contains a new random request ID, its timestamp,
          success or failure, cache delivery mode, external or fallback content
          mode, resolved category, theme, device-size preset, and response
          status. It does not contain an IP address, user agent, full URL,
          selected-interest list, personal note, custom-background ID, phone
          identifier, or account identifier. Events cannot be joined into a
          user history and are retained by Cloudflare Analytics Engine for up
          to three months. Reporting access is limited to a separately
          protected private administration service.
        </p>

        <h2>Optional privacy-first website analytics</h2>
        <p>
          A production deployment may enable Cloudflare Web Analytics to
          understand aggregate page traffic. It uses no cookies and WallCab
          sends no custom personal identifiers. The analytics script is absent
          when no public analytics token is configured.
        </p>

        <h2>Optional project support</h2>
        <p>
          If you choose to support WallCab, Razorpay hosts the payment page
          and processes the amount, email address, phone number, payment
          method, receipt, and settlement under its own privacy terms. WallCab
          does not receive card, bank, UPI credential, or complete payment
          instrument details.
        </p>
        <p>
          After a successful payment, Razorpay sends WallCab a signed event
          containing the payment reference, amount, currency, email address,
          optional supporter name, and standard payment metadata. WallCab
          validates it and passes the name when available, email address,
          amount, and payment reference directly to Resend to deliver one
          transactional thank-you. WallCab does not write the supporter name,
          email, phone number, webhook body, or payment reference to its
          database or application logs. Resend retains delivery records
          according to its plan and privacy terms.
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
