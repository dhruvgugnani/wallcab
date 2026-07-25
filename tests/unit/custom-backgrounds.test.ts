import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isCustomBackgroundDeleteToken,
  isCustomBackgroundId,
} from "@/features/wallpaper/custom-background";
import { parseWallpaperSearchParams } from "@/features/wallpaper/validation";

const cacheMocks = vi.hoisted(() => ({
  getCustomBackground: vi.fn(),
  putCustomBackground: vi.fn(),
}));

vi.mock("@/server/cache/client", () => cacheMocks);

import {
  MAX_CUSTOM_UPLOAD_BYTES,
  normalizeCustomBackground,
  resolveCustomBackground,
  storeCustomBackground,
} from "@/server/custom-backgrounds";

beforeEach(() => {
  vi.clearAllMocks();
  cacheMocks.putCustomBackground.mockResolvedValue(true);
});

describe("custom backgrounds", () => {
  it("accepts an opaque custom background ID in a wallpaper URL", () => {
    const id = "aB_9-".repeat(5).slice(0, 22);
    const parsed = parseWallpaperSearchParams(
      new URLSearchParams(
        `categories=science&theme=grid&size=max&background=${id}`,
      ),
    );

    expect(parsed).toEqual({
      success: true,
      value: {
        categories: ["science"],
        theme: "grid",
        size: "max",
        customBackgroundId: id,
      },
    });
  });

  it("rejects malformed custom background IDs", () => {
    const parsed = parseWallpaperSearchParams(
      new URLSearchParams("background=../../private"),
    );

    expect(parsed.success).toBe(false);
  });

  it("normalizes an image to a private metadata-free WebP", async () => {
    const source = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 3,
        background: "#43533f",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const output = await normalizeCustomBackground(
      new Uint8Array(source),
    );
    const metadata = await sharp(output).metadata();

    expect(metadata).toMatchObject({
      format: "webp",
      width: 1320,
      height: 2868,
    });
    expect(metadata.orientation).toBeUndefined();
    expect(output.byteLength).toBeLessThanOrEqual(MAX_CUSTOM_UPLOAD_BYTES);
  });

  it("rejects small or unsupported images before storage", async () => {
    const small = await sharp({
      create: {
        width: 599,
        height: 700,
        channels: 3,
        background: "#000",
      },
    })
      .png()
      .toBuffer();

    await expect(
      normalizeCustomBackground(new Uint8Array(small)),
    ).rejects.toThrow("INVALID_CUSTOM_BACKGROUND_IMAGE");
    await expect(
      normalizeCustomBackground(new TextEncoder().encode("not an image")),
    ).rejects.toThrow();
  });

  it("creates unguessable IDs and stores only a delete-token hash", async () => {
    const source = await sharp({
      create: {
        width: 600,
        height: 600,
        channels: 3,
        background: "#223322",
      },
    })
      .webp()
      .toBuffer();

    const stored = await storeCustomBackground(new Uint8Array(source));
    expect(stored).not.toBeNull();
    expect(isCustomBackgroundId(stored?.id)).toBe(true);
    expect(isCustomBackgroundDeleteToken(stored?.deleteToken)).toBe(true);
    expect(cacheMocks.putCustomBackground).toHaveBeenCalledWith(
      stored?.id,
      expect.any(Uint8Array),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(cacheMocks.putCustomBackground.mock.calls[0]?.[2]).not.toBe(
      stored?.deleteToken,
    );
  });

  it("does not expose a missing or invalid stored object", async () => {
    cacheMocks.getCustomBackground.mockResolvedValue(
      new Response("wrong", {
        headers: { "Content-Type": "text/plain" },
      }),
    );
    await expect(resolveCustomBackground("A".repeat(22))).resolves.toBeNull();
  });
});
