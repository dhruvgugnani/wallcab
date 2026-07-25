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

const manifestMocks = vi.hoisted(() => ({
  getPreparedManifest: vi.fn(),
  resolveDailyLesson: vi.fn(),
}));

const afterMock = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/server/cache/client", () => cacheMocks);
vi.mock("@/server/wallpaper-renderer", () => rendererMocks);
vi.mock("@/server/daily-manifest", () => manifestMocks);

const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  cacheMocks.getCachedWallpaperUrl.mockResolvedValue(null);
  cacheMocks.putCacheValue.mockResolvedValue(true);
  manifestMocks.getPreparedManifest.mockResolvedValue(null);
  manifestMocks.resolveDailyLesson.mockImplementation(
    (category: string) => ({
      date: "2026-07-25",
      category,
      term: "Fixture",
      definition: "A fixture lesson.",
      quote: { text: "A useful thought.", author: "Tester" },
      fact: "A bounded fact.",
      sources: [
        {
          label: "Wikipedia",
          url: "https://en.wikipedia.org/wiki/Fixture",
          license: "CC BY-SA 4.0",
        },
      ],
      provenance: { mode: "external", provider: "Wikimedia" },
    }),
  );
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

async function statusRoute() {
  return import("@/app/api/wallpaper/status/route");
}

describe("wallpaper route", () => {
  it("returns a generated PNG with descriptive headers", async () => {
    const { GET } = await route();
    const response = await GET(
      new Request(
        "http://localhost/api/wallpaper?categories=science&theme=space&size=max",
        { headers: { "x-real-ip": "192.0.2.20" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-wallcab-date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.headers.get("x-wallcab-category")).toBe("science");
    expect(response.headers.get("x-wallcab-categories")).toBe("science");
    expect(response.headers.get("x-wallcab-content-mode")).toBe("external");
    expect(response.headers.get("x-wallcab-content-provider")).toBe(
      "Wikimedia",
    );
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
      new Request("http://localhost/api/wallpaper?categories=horoscopes", {
        headers: { "x-real-ip": "192.0.2.22" },
      }),
    );
    const body = (await response.json()) as {
      code: string;
      allowed: { categories: string[]; theme: string[]; size: string[] };
    };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_WALLPAPER_OPTIONS");
    expect(body.allowed.categories).toContain("vocabulary");
    expect(body.allowed.theme).toContain("abstract");
    expect(body.allowed.theme).toContain("grid");
    expect(body.allowed.theme).toContain("monochrome");
    expect(body.allowed.size).toEqual(["standard", "air", "max"]);
  });

  it("rejects the replaced singular category parameter", async () => {
    const { GET } = await route();
    const response = await GET(
      new Request("http://localhost/api/wallpaper?category=science", {
        headers: { "x-real-ip": "192.0.2.26" },
      }),
    );
    const body = (await response.json()) as {
      code: string;
      message: string;
    };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_WALLPAPER_OPTIONS");
    expect(body.message).toContain("categories=");
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
        "http://localhost/api/wallpaper?categories=finance&theme=minimal&size=air",
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

  it("reports the resolved daily category and provider provenance", async () => {
    const { GET } = await statusRoute();
    const response = await GET(
      new Request(
        "http://localhost/api/wallpaper/status?categories=science,coding,history&theme=forest&size=standard",
        { headers: { "x-real-ip": "192.0.2.27" } },
      ),
    );
    const body = (await response.json()) as {
      selectedCategories: string[];
      resolvedCategory: string;
      content: { mode: string; provider: string };
    };

    expect(response.status).toBe(200);
    expect(body.selectedCategories).toEqual([
      "coding",
      "science",
      "history",
    ]);
    expect(body.selectedCategories).toContain(body.resolvedCategory);
    expect(body.content).toEqual({
      mode: "external",
      provider: "Wikimedia",
      source: {
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Fixture",
        license: "CC BY-SA 4.0",
      },
    });
  });
});
