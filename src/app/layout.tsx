import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/manrope";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WallCab — Learn something every time you unlock",
    template: "%s — WallCab",
  },
  description:
    "A free daily learning wallpaper for iPhone, delivered automatically with Apple Shortcuts.",
  applicationName: "WallCab",
  authors: [{ name: "Dhruv Gugnani", url: siteUrl }],
  creator: "Dhruv Gugnani",
  publisher: "WallCab",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "WallCab",
    title: "WallCab — Your lock screen, made useful",
    description:
      "One sourced idea, beautifully composed for your iPhone every day.",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WallCab — Your lock screen, made useful",
    description:
      "One sourced idea, beautifully composed for your iPhone every day.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0a08",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analyticsToken = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <div className="site-frame">
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
        </div>
        {analyticsToken ? (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: analyticsToken })}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
