import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceDimensions } from "@/features/wallpaper/types";
import {
  MAX_WALLPAPER_BYTES,
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

  it(
    "renders a correctly sized PNG below the KV target",
    async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
      );
      const wallpaper = await renderWallpaper(
        { category: "science", theme: "space", size: "standard" },
        new Date("2026-07-25T12:00:00Z"),
      );
      const metadata = await sharp(wallpaper.bytes).metadata();

      expect(metadata.format).toBe("png");
      expect(metadata.width).toBe(deviceDimensions.standard.width);
      expect(metadata.height).toBe(deviceDimensions.standard.height);
      expect(wallpaper.byteLength).toBeLessThanOrEqual(MAX_WALLPAPER_BYTES);
    },
    60_000,
  );
});
