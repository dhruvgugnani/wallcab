import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deviceDimensions,
  devicePresets,
} from "@/features/wallpaper/types";
import {
  MAX_WALLPAPER_BYTES,
  rasterizeSvgWithBundledFonts,
  renderWallpaper,
  wrapText,
} from "@/server/wallpaper-renderer";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wallpaper renderer", () => {
  it("wraps long text into a bounded number of lines", () => {
    const lines = wrapText(
      "A deliberately long sentence that needs to fit inside a small wallpaper region without overflowing",
      24,
      3,
    );
    expect(lines).toHaveLength(3);
    expect(lines.at(-1)).toMatch(/…$/);
  });

  it("renders text using bundled fonts without system fonts", async () => {
    const png = rasterizeSvgWithBundledFonts(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
        <text x="20" y="80" font-family="Manrope" font-size="64" fill="#fff">
          WALLCAB
        </text>
      </svg>
    `);
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let visiblePixels = 0;

    for (let index = 3; index < data.length; index += 4) {
      if (data[index]! > 0) {
        visiblePixels += 1;
      }
    }

    expect(info.width).toBe(400);
    expect(info.height).toBe(120);
    expect(visiblePixels).toBeGreaterThan(100);
  });

  it.each(devicePresets)(
    "renders the %s PNG at the correct size below the KV target",
    async (size) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
      );
      const wallpaper = await renderWallpaper(
        { category: "science", theme: "space", size },
        new Date("2026-07-25T12:00:00Z"),
      );
      const metadata = await sharp(wallpaper.bytes).metadata();

      expect(metadata.format).toBe("png");
      expect(metadata.width).toBe(deviceDimensions[size].width);
      expect(metadata.height).toBe(deviceDimensions[size].height);
      expect(wallpaper.byteLength).toBeLessThanOrEqual(MAX_WALLPAPER_BYTES);
    },
    60_000,
  );
});
