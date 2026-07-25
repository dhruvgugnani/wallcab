import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deviceDimensions,
  devicePresets,
  learningCategories,
} from "@/features/wallpaper/types";
import { getFallbackLesson } from "@/features/wallpaper/daily";
import {
  fitWallpaperText,
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

  it("hard-wraps unbroken provider text without crossing the line bound", () => {
    const lines = wrapText("x".repeat(90), 18, 3);

    expect(lines).toHaveLength(3);
    expect(lines.every((line) => line.length <= 18)).toBe(true);
    expect(lines.at(-1)).toMatch(/…$/);
  });

  it("keeps every reviewed lesson inside the renderer text limits", () => {
    for (const category of learningCategories) {
      const layout = fitWallpaperText(
        getFallbackLesson(category, new Date("2026-07-25T00:00:00Z")),
      );

      expect(layout.termLines.length).toBeLessThanOrEqual(2);
      expect(layout.termLines.every((line) => line.length <= 18)).toBe(true);
      expect(layout.definitionLines.length).toBeLessThanOrEqual(4);
      expect(
        layout.definitionLines.every((line) => line.length <= 36),
      ).toBe(true);
      expect(layout.quoteLines.length).toBeLessThanOrEqual(3);
      expect(layout.quoteLines.every((line) => line.length <= 34)).toBe(
        true,
      );
      expect(layout.factLines.length).toBeLessThanOrEqual(4);
      expect(layout.factLines.every((line) => line.length <= 38)).toBe(
        true,
      );
    }
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
