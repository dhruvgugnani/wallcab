import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  DEFAULT_SHORTCUT_URL,
  GITHUB_URL,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site-config";

describe("public site discovery configuration", () => {
  it("keeps all sitemap entries on the canonical HTTPS origin", () => {
    const entries = sitemap();

    expect(entries.length).toBeGreaterThanOrEqual(16);
    expect(entries.every((entry) => entry.url.startsWith(`${SITE_URL}/`))).toBe(
      true,
    );
    expect(entries.some((entry) => entry.url === `${SITE_URL}/install`)).toBe(
      true,
    );
  });

  it("publishes the canonical sitemap through robots", () => {
    const rules = robots();

    expect(rules.host).toBe(SITE_URL);
    expect(rules.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("uses the final public links", () => {
    expect(absoluteUrl("/install")).toBe(`${SITE_URL}/install`);
    expect(DEFAULT_SHORTCUT_URL).toContain("icloud.com/shortcuts/");
    expect(GITHUB_URL).toBe("https://github.com/dhruvgugnani/wallcab");
  });
});
