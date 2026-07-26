import sharp from "sharp";
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
      expect(new TextDecoder().decode(asset.bytes)).toContain(
        `data-theme-motif="${theme}"`,
      );
    }
  });

  it("accepts only a tall, theme-matched photograph from Openverse", async () => {
    const jpeg = await sharp({
      create: {
        width: 32,
        height: 48,
        channels: 3,
        background: "#315a36",
      },
    })
      .jpeg()
      .toBuffer();
    const imageResponse = new Response(new Uint8Array(jpeg), {
      headers: { "content-type": "image/jpeg" },
    });
    Object.defineProperty(imageResponse, "url", {
      value: "https://cdn.stocksnap.io/img-thumbs/960w/NATURE.jpg",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          results: [
            {
              title: "Vintage nature plate",
              url: "https://live.staticflickr.com/archive.jpg",
              foreign_landing_url: "https://example.com/archive",
              creator: "Archive",
              license: "pdm",
              source: "stocksnap",
              category: "illustration",
              width: 1_200,
              height: 1_800,
              tags: [{ name: "nature" }, { name: "illustration" }],
            },
            {
              title: "Plants Nature",
              url: "https://cdn.stocksnap.io/img-thumbs/960w/NATURE.jpg",
              foreign_landing_url:
                "https://stocksnap.io/photo/plants-nature-NATURE",
              creator: "Fixture Photographer",
              license: "cc0",
              source: "stocksnap",
              category: "photograph",
              width: 2_570,
              height: 3_980,
              tags: [
                { name: "garden" },
                { name: "green" },
                { name: "leaves" },
                { name: "nature" },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(imageResponse);
    vi.stubGlobal("fetch", fetchMock);

    const asset = await getBackgroundAsset(
      "nature",
      new Date("2026-07-26T00:00:00Z"),
    );

    expect(asset.contentType).toBe("image/jpeg");
    expect(asset.attribution).toMatchObject({
      label: "Photo by Fixture Photographer",
      source: "stocksnap",
      license: "CC0",
    });
    const searchUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(searchUrl.searchParams.get("q")).toBe("plants nature");
    expect(searchUrl.searchParams.get("category")).toBe("photograph");
    expect(searchUrl.searchParams.get("aspect_ratio")).toBe("tall");
    expect(searchUrl.searchParams.get("size")).toBe("large");
    expect(searchUrl.searchParams.get("source")).toBe("stocksnap");
  });

  it("falls back when provider metadata does not match the selected theme", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: [
          {
            title: "Office portrait",
            url: "https://cdn.stocksnap.io/img-thumbs/960w/OFFICE.jpg",
            creator: "Fixture Photographer",
            license: "cc0",
            source: "stocksnap",
            category: "photograph",
            width: 2_000,
            height: 3_000,
            tags: [
              { name: "people" },
              { name: "technology" },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const asset = await getBackgroundAsset(
      "nature",
      new Date("2026-07-26T00:00:00Z"),
    );

    expect(asset.contentType).toBe("image/svg+xml");
    expect(asset.attribution.source).toBe("WallCab fallback");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
