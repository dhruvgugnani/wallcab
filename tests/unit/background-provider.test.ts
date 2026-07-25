import { afterEach, describe, expect, it, vi } from "vitest";
import {
  originalThemes,
  photographicThemes,
} from "@/features/wallpaper/types";
import { getBackgroundAsset } from "@/server/services/background-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("background provider", () => {
  it("keeps every WallCab Original fixed across UTC days", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const theme of originalThemes) {
      const first = await getBackgroundAsset(
        theme,
        new Date("2026-07-25T00:00:00Z"),
      );
      const later = await getBackgroundAsset(
        theme,
        new Date("2026-09-12T00:00:00Z"),
      );

      expect(first.contentType).toBe("image/svg+xml");
      expect(first.bytes).toEqual(later.bytes);
      expect(first.attribution).toMatchObject({
        creator: "WallCab",
        source: "WallCab Original",
        license: "CC0 1.0",
      });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ships six distinct WallCab Original SVG compositions", async () => {
    const artworks = await Promise.all(
      originalThemes.map(async (theme) => {
        const asset = await getBackgroundAsset(theme);
        return new TextDecoder().decode(asset.bytes);
      }),
    );

    expect(originalThemes).toHaveLength(6);
    expect(new Set(artworks).size).toBe(6);
    for (const artwork of artworks) {
      expect(artwork).toContain('width="1320"');
      expect(artwork).toContain('height="2868"');
    }
  });

  it("retains provider-backed daily photography with a safe fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    for (const theme of photographicThemes) {
      const asset = await getBackgroundAsset(
        theme,
        new Date("2026-07-25T00:00:00Z"),
      );
      expect(asset.contentType).toBe("image/svg+xml");
      expect(asset.attribution.source).toBe("WallCab fallback");
    }
  });
});
