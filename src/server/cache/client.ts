import {
  sha256Hex,
  signPublicCacheKey,
  signServiceRequest,
} from "@/server/cache/signing";
import type {
  DevicePreset,
  LearningCategory,
  VisualTheme,
} from "@/features/wallpaper/types";

const CACHE_TIMEOUT_MS = 2_500;
const CUSTOM_BACKGROUND_TIMEOUT_MS = 8_000;
const ANALYTICS_TIMEOUT_MS = 2_500;

export type WallpaperRunEvent = {
  requestId: string;
  outcome: "success" | "failure";
  delivery: "cache_hit" | "generated" | "bypass" | "error";
  contentMode: "external" | "fallback";
  category: LearningCategory;
  theme: VisualTheme;
  size: DevicePreset;
  status: number;
};

type CacheConfiguration = {
  baseUrl: string;
  serviceSecret: string;
  signingSecret: string;
};

function getCacheConfiguration(): CacheConfiguration | null {
  const baseUrl = process.env.CACHE_WORKER_URL?.replace(/\/+$/, "");
  const serviceSecret = process.env.CACHE_WORKER_SECRET;
  const signingSecret = process.env.CACHE_SIGNING_SECRET;

  if (!baseUrl || !serviceSecret || !signingSecret) {
    return null;
  }

  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1") {
      return null;
    }
  } catch {
    return null;
  }

  return { baseUrl, serviceSecret, signingSecret };
}

function privateHeaders(
  method: string,
  url: URL,
  bodyHash: string,
  serviceSecret: string,
): HeadersInit {
  const timestamp = Math.floor(Date.now() / 1_000);
  return {
    "x-wallcab-body-sha256": bodyHash,
    "x-wallcab-signature": signServiceRequest(
      method,
      url.pathname,
      timestamp,
      bodyHash,
      serviceSecret,
    ),
    "x-wallcab-timestamp": String(timestamp),
  };
}

function cachePath(key: string): string {
  return `/v1/cache/${encodeURIComponent(key)}`;
}

function customBackgroundPath(id: string): string {
  return `/v1/custom-backgrounds/${encodeURIComponent(id)}`;
}

export async function recordWallpaperRun(
  event: WallpaperRunEvent,
): Promise<boolean> {
  const config = getCacheConfiguration();
  if (!config) {
    return false;
  }

  const url = new URL("/v1/analytics/runs", config.baseUrl);
  const body = JSON.stringify(event);
  const bodyHash = sha256Hex(body);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...privateHeaders(
          "POST",
          url,
          bodyHash,
          config.serviceSecret,
        ),
        "content-type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function createPublicCacheUrl(
  key: string,
  ttlSeconds = 300,
): string | null {
  const config = getCacheConfiguration();
  if (!config) {
    return null;
  }

  const expires = Math.floor(Date.now() / 1_000) + ttlSeconds;
  const signature = signPublicCacheKey(key, expires, config.signingSecret);
  const url = new URL(
    `/v1/wallpapers/${encodeURIComponent(key)}`,
    config.baseUrl,
  );
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("sig", signature);
  return url.toString();
}

export async function getCachedWallpaperUrl(
  key: string,
): Promise<string | null> {
  const url = createPublicCacheUrl(key);
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(CACHE_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok ? url : null;
  } catch {
    return null;
  }
}

export async function getPrivateCacheValue(
  key: string,
): Promise<Response | null> {
  const config = getCacheConfiguration();
  if (!config) {
    return null;
  }

  const url = new URL(cachePath(key), config.baseUrl);
  const bodyHash = sha256Hex("");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: privateHeaders(
        "GET",
        url,
        bodyHash,
        config.serviceSecret,
      ),
      signal: AbortSignal.timeout(CACHE_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

export async function putCacheValue(
  key: string,
  bytes: Uint8Array,
  contentType: string,
  expiration: number,
): Promise<boolean> {
  const config = getCacheConfiguration();
  if (!config) {
    return false;
  }

  const url = new URL(cachePath(key), config.baseUrl);
  const bodyHash = sha256Hex(bytes);

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...privateHeaders(
          "PUT",
          url,
          bodyHash,
          config.serviceSecret,
        ),
        "content-type": contentType,
        "x-wallcab-expiration": String(expiration),
      },
      body: Buffer.from(bytes),
      signal: AbortSignal.timeout(CACHE_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getCustomBackground(
  id: string,
): Promise<Response | null> {
  const config = getCacheConfiguration();
  if (!config) {
    return null;
  }

  const url = new URL(customBackgroundPath(id), config.baseUrl);
  const bodyHash = sha256Hex("");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: privateHeaders(
        "GET",
        url,
        bodyHash,
        config.serviceSecret,
      ),
      signal: AbortSignal.timeout(CUSTOM_BACKGROUND_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

export async function putCustomBackground(
  id: string,
  bytes: Uint8Array,
  deleteTokenHash: string,
): Promise<boolean> {
  const config = getCacheConfiguration();
  if (!config) {
    return false;
  }

  const url = new URL(customBackgroundPath(id), config.baseUrl);
  const bodyHash = sha256Hex(bytes);

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...privateHeaders(
          "PUT",
          url,
          bodyHash,
          config.serviceSecret,
        ),
        "content-type": "image/webp",
        "x-wallcab-delete-token-sha256": deleteTokenHash,
      },
      body: Buffer.from(bytes),
      signal: AbortSignal.timeout(CUSTOM_BACKGROUND_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function deleteCustomBackground(
  id: string,
  deleteTokenHash: string,
): Promise<boolean> {
  const config = getCacheConfiguration();
  if (!config) {
    return false;
  }

  const url = new URL(customBackgroundPath(id), config.baseUrl);
  const bodyHash = sha256Hex("");

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...privateHeaders(
          "DELETE",
          url,
          bodyHash,
          config.serviceSecret,
        ),
        "x-wallcab-delete-token-sha256": deleteTokenHash,
      },
      signal: AbortSignal.timeout(CUSTOM_BACKGROUND_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
