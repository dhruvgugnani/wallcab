import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { BackgroundAsset } from "@/features/wallpaper/types";
import { SITE_URL } from "@/lib/site-config";
import {
  getCustomBackground,
  putCustomBackground,
} from "@/server/cache/client";
import { sha256Hex } from "@/server/cache/signing";

export const MAX_CUSTOM_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_CUSTOM_PIXELS = 40_000_000;
const CUSTOM_WIDTH = 1320;
const CUSTOM_HEIGHT = 2868;

export type StoredCustomBackground = {
  id: string;
  deleteToken: string;
};

export async function normalizeCustomBackground(
  source: Uint8Array,
): Promise<Uint8Array> {
  if (source.byteLength === 0 || source.byteLength > MAX_CUSTOM_UPLOAD_BYTES) {
    throw new Error("INVALID_CUSTOM_BACKGROUND_SIZE");
  }

  const input = sharp(source, {
    failOn: "warning",
    limitInputPixels: MAX_CUSTOM_PIXELS,
  });
  const metadata = await input.metadata();

  if (
    !metadata.format ||
    !["jpeg", "png", "webp"].includes(metadata.format) ||
    !metadata.width ||
    !metadata.height ||
    metadata.width < 600 ||
    metadata.height < 600
  ) {
    throw new Error("INVALID_CUSTOM_BACKGROUND_IMAGE");
  }

  const output = await input
    .rotate()
    .resize(CUSTOM_WIDTH, CUSTOM_HEIGHT, {
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 84, effort: 6 })
    .toBuffer();

  if (output.byteLength > MAX_CUSTOM_UPLOAD_BYTES) {
    throw new Error("CUSTOM_BACKGROUND_TOO_COMPLEX");
  }

  return new Uint8Array(output);
}

export async function storeCustomBackground(
  source: Uint8Array,
): Promise<StoredCustomBackground | null> {
  const bytes = await normalizeCustomBackground(source);
  const id = randomBytes(16).toString("base64url");
  const deleteToken = randomBytes(32).toString("base64url");
  const stored = await putCustomBackground(
    id,
    bytes,
    sha256Hex(deleteToken),
  );

  return stored ? { id, deleteToken } : null;
}

export async function resolveCustomBackground(
  id: string,
): Promise<BackgroundAsset | null> {
  const response = await getCustomBackground(id);
  if (
    !response ||
    response.headers.get("content-type") !== "image/webp"
  ) {
    return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CUSTOM_UPLOAD_BYTES) {
    return null;
  }

  return {
    bytes,
    contentType: "image/webp",
    attribution: {
      label: "Your custom background",
      url: `${SITE_URL}/privacy`,
      license: "User supplied",
      source: "User upload",
    },
  };
}
