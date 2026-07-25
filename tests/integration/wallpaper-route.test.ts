import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({
  getCachedWallpaperUrl: vi.fn(),
  putCacheValue: vi.fn(),
}));

const rendererMocks = vi.hoisted(() => ({
  renderWallpaper: vi.fn(),
  wallpaperCacheKey: vi.fn(
    (
      request: { category: string; theme: string; size: string },
      date: string,
    ) =>
      `wallpaper/v1/${date}/${request.category}/${request.theme}/${request.size}.png`,
  ),
}));

const afterMock = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/server/cache/client", () => cacheMocks);
vi.mock("@/server/wallpaper-renderer", () => rendererMocks);

const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  cacheMocks.getCachedWallpaperUrl.mockResolvedValue(null);
  cacheMocks.putCacheValue.mockResolvedValue(true);
  rendererMocks.renderWallpaper.mockResolvedValue({
    bytes: pngBytes,
    byteLength: pngBytes.byteLength,
    key: "wallpaper/v1/2026-07-25/science/space/max.png",
    date: "2026-07-25",
    category: "science",
    theme: "space",
    size: "max",
    etag: "fixture-etag",
    lesson: {},
    background: {},
  });
});

async function route() {
  return import("@/app/api/wallpaper/route");
}

describe("wallpaper route", () => {
  it("returns a generated PNG with descriptive headers", async () => {
    const { GET } = await route();
    const response = await GET(
      new Request(
        "http://localhost/api/wallpaper?category=science&theme=space&size=max",
        { headers: { "x-real-ip": "192.0.2.20" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-wallcab-date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.headers.get("x-wallcab-category")).toBe("science");
    expect(response.headers.get("x-wallcab-theme")).toBe("space");
    expect(response.headers.get("x-wallcab-size")).toBe("max");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes);
  });

  it("supports HEAD without returning an image body", async () => {
    const { HEAD } = await route();
    const response = await HEAD(
      new Request("http://localhost/api/wallpaper", {
        method: "HEAD",
        headers: { "x-real-ip": "192.0.2.21" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it("returns allowed values for invalid parameters", async () => {
    const { GET } = await route();
    const response = await GET(
      new Request("http://localhost/api/wallpaper?category=horoscopes", {
        headers: { "x-real-ip": "192.0.2.22" },
      }),
    );
    const body = (await response.json()) as {
      code: string;
      allowed: { category: string[]; theme: string[]; size: string[] };
    };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_WALLPAPER_OPTIONS");
    expect(body.allowed.category).toContain("vocabulary");
    expect(body.allowed.theme).toContain("abstract");
    expect(body.allowed.size).toEqual(["standard", "air", "max"]);
  });

  it("redirects cache hits to the signed Worker asset", async () => {
    cacheMocks.getCachedWallpaperUrl.mockResolvedValue(
      "https://cache.example/v1/wallpapers/example?expires=1&sig=abc",
    );
    const { GET } = await route();
    const response = await GET(
      new Request("http://localhost/api/wallpaper", {
        headers: { "x-real-ip": "192.0.2.23" },
        redirect: "manual",
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("cache.example");
    expect(response.headers.get("x-wallcab-cache")).toBe("HIT");
    expect(rendererMocks.renderWallpaper).not.toHaveBeenCalled();
  });

  it("returns the first image when background cache upload is unavailable", async () => {
    afterMock.mockImplementation((callback: () => Promise<void>) => {
      void callback();
    });
    cacheMocks.putCacheValue.mockResolvedValue(false);
    const { GET } = await route();
    const response = await GET(
      new Request(
        "http://localhost/api/wallpaper?category=finance&theme=minimal&size=air",
        { headers: { "x-real-ip": "192.0.2.24" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-wallcab-cache")).toBe("MISS");
  });

  it("returns a structured renderer failure", async () => {
    rendererMocks.renderWallpaper.mockRejectedValue(new Error("provider down"));
    const { GET } = await route();
    const response = await GET(
      new Request("http://localhost/api/wallpaper", {
        headers: { "x-real-ip": "192.0.2.25" },
      }),
    );
    const body = (await response.json()) as { code: string; requestId: string };

    expect(response.status).toBe(502);
    expect(body.code).toBe("WALLPAPER_GENERATION_FAILED");
    expect(body.requestId).toBeTruthy();
  });
});
