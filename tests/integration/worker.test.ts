import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  sha256Hex,
  signPublicCacheKey,
  signServiceRequest,
} from "@/server/cache/signing";

const serviceSecret = "service-secret-for-tests";
const signingSecret = "signing-secret-for-tests";
let worker: Miniflare;

function timestamp(): number {
  return Math.floor(Date.now() / 1_000);
}

function privateHeaders(
  method: string,
  pathname: string,
  body: Uint8Array | string,
  expiration?: number,
): HeadersInit {
  const now = timestamp();
  const bodyHash = sha256Hex(body);
  return {
    "content-type": "image/png",
    "x-wallcab-body-sha256": bodyHash,
    "x-wallcab-signature": signServiceRequest(
      method,
      pathname,
      now,
      bodyHash,
      serviceSecret,
    ),
    "x-wallcab-timestamp": String(now),
    ...(expiration
      ? { "x-wallcab-expiration": String(expiration) }
      : {}),
  };
}

beforeAll(async () => {
  const source = await readFile(
    join(process.cwd(), "worker", "src", "index.ts"),
    "utf8",
  );
  const script = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;

  worker = new Miniflare({
    compatibilityDate: "2026-07-25",
    modules: true,
    script,
    kvNamespaces: ["WALLPAPERS"],
    bindings: {
      CACHE_WORKER_SECRET: serviceSecret,
      CACHE_SIGNING_SECRET: signingSecret,
      ALLOWED_ORIGINS: "https://wallcab.example",
    },
  });
});

afterAll(async () => {
  await worker.dispose();
});

describe("Cloudflare Worker cache", () => {
  const key = "wallpaper/v1/2026-07-25/science/space/standard.png";
  const privatePath = `/v1/cache/${encodeURIComponent(key)}`;
  const publicPath = `/v1/wallpapers/${encodeURIComponent(key)}`;
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

  it("rejects unauthenticated private writes", async () => {
    const response = await worker.dispatchFetch(
      `https://worker.example${privatePath}`,
      {
        method: "PUT",
        headers: {
          "content-type": "image/png",
          "x-wallcab-expiration": String(timestamp() + 600),
        },
        body: png,
      },
    );

    expect(response.status).toBe(401);
  });

  it("uploads and reads an authenticated value", async () => {
    const expiration = timestamp() + 600;
    const write = await worker.dispatchFetch(
      `https://worker.example${privatePath}`,
      {
        method: "PUT",
        headers: privateHeaders("PUT", privatePath, png, expiration),
        body: png,
      },
    );
    expect(write.status).toBe(201);

    const expires = timestamp() + 300;
    const signature = signPublicCacheKey(key, expires, signingSecret);
    const response = await worker.dispatchFetch(
      `https://worker.example${publicPath}?expires=${expires}&sig=${signature}`,
      { headers: { origin: "https://wallcab.example" } },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://wallcab.example",
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
  });

  it("supports signed HEAD without returning a body", async () => {
    const expires = timestamp() + 300;
    const signature = signPublicCacheKey(key, expires, signingSecret);
    const response = await worker.dispatchFetch(
      `https://worker.example${publicPath}?expires=${expires}&sig=${signature}`,
      { method: "HEAD" },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe(String(png.byteLength));
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it("rejects invalid public signatures and missing keys", async () => {
    const expires = timestamp() + 300;
    const invalid = await worker.dispatchFetch(
      `https://worker.example${publicPath}?expires=${expires}&sig=invalid`,
    );
    expect(invalid.status).toBe(401);

    const missingKey = "wallpaper/v1/missing.png";
    const missingPath = `/v1/wallpapers/${encodeURIComponent(missingKey)}`;
    const signature = signPublicCacheKey(
      missingKey,
      expires,
      signingSecret,
    );
    const missing = await worker.dispatchFetch(
      `https://worker.example${missingPath}?expires=${expires}&sig=${signature}`,
    );
    expect(missing.status).toBe(404);
  });

  it("enforces CORS and declared write size limits", async () => {
    const options = await worker.dispatchFetch(
      "https://worker.example/v1/cache/example",
      {
        method: "OPTIONS",
        headers: { origin: "https://wallcab.example" },
      },
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBe(
      "https://wallcab.example",
    );

    const expiration = timestamp() + 600;
    const oversizedBody = new Uint8Array(5 * 1024 * 1024 + 1);
    const oversized = await worker.dispatchFetch(
      "https://worker.example/v1/cache/oversized",
      {
        method: "PUT",
        headers: privateHeaders(
          "PUT",
          "/v1/cache/oversized",
          oversizedBody,
          expiration,
        ),
        body: oversizedBody,
      },
    );
    expect(oversized.status).toBe(413);
  });

  it("privately uploads, reads, and deletes a custom KV background", async () => {
    const id = "A".repeat(22);
    const pathname = `/v1/custom-backgrounds/${id}`;
    const webp = Uint8Array.from([82, 73, 70, 70, 1, 2, 3, 4]);
    const deleteTokenHash = sha256Hex("private-delete-token");
    const putHeaders = {
      ...privateHeaders("PUT", pathname, webp),
      "content-type": "image/webp",
      "x-wallcab-delete-token-sha256": deleteTokenHash,
    };
    const write = await worker.dispatchFetch(
      `https://worker.example${pathname}`,
      {
        method: "PUT",
        headers: putHeaders,
        body: webp,
      },
    );
    expect(write.status).toBe(201);

    const read = await worker.dispatchFetch(
      `https://worker.example${pathname}`,
      {
        method: "GET",
        headers: privateHeaders("GET", pathname, ""),
      },
    );
    expect(read.status).toBe(200);
    expect(read.headers.get("content-type")).toBe("image/webp");
    expect(read.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(webp);

    const head = await worker.dispatchFetch(
      `https://worker.example${pathname}`,
      {
        method: "HEAD",
        headers: privateHeaders("HEAD", pathname, ""),
      },
    );
    expect(head.status).toBe(200);
    expect((await head.arrayBuffer()).byteLength).toBe(0);

    const wrongHash = sha256Hex("wrong-delete-token");
    const wrongDelete = await worker.dispatchFetch(
      `https://worker.example${pathname}`,
      {
        method: "DELETE",
        headers: {
          ...privateHeaders("DELETE", pathname, ""),
          "x-wallcab-delete-token-sha256": wrongHash,
        },
      },
    );
    expect(wrongDelete.status).toBe(404);

    const deleted = await worker.dispatchFetch(
      `https://worker.example${pathname}`,
      {
        method: "DELETE",
        headers: {
          ...privateHeaders("DELETE", pathname, ""),
          "x-wallcab-delete-token-sha256": deleteTokenHash,
        },
      },
    );
    expect(deleted.status).toBe(200);

    const missing = await worker.dispatchFetch(
      `https://worker.example${pathname}`,
      {
        method: "GET",
        headers: privateHeaders("GET", pathname, ""),
      },
    );
    expect(missing.status).toBe(404);
  });

  it("rejects unauthenticated and oversized custom uploads", async () => {
    const id = "Z".repeat(22);
    const pathname = `/v1/custom-backgrounds/${id}`;
    const unauthenticated = await worker.dispatchFetch(
      `https://worker.example${pathname}`,
      {
        method: "PUT",
        headers: {
          "content-type": "image/webp",
          "x-wallcab-delete-token-sha256": sha256Hex("token"),
        },
        body: Uint8Array.from([1]),
      },
    );
    expect(unauthenticated.status).toBe(401);

    const oversizedBody = new Uint8Array(4 * 1024 * 1024 + 1);
    const oversized = await worker.dispatchFetch(
      `https://worker.example${pathname}`,
      {
        method: "PUT",
        headers: {
          ...privateHeaders("PUT", pathname, oversizedBody),
          "content-type": "image/webp",
          "x-wallcab-delete-token-sha256": sha256Hex("token"),
        },
        body: oversizedBody,
      },
    );
    expect(oversized.status).toBe(413);
  });
});
