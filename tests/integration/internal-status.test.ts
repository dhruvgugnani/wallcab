import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const manifestMocks = vi.hoisted(() => ({
  getPreparedManifest: vi.fn(),
  getCachedDailyLesson: vi.fn(),
}));

vi.mock("@/server/daily-manifest", () => manifestMocks);

const previousCronSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
  manifestMocks.getPreparedManifest.mockResolvedValue(null);
  manifestMocks.getCachedDailyLesson.mockResolvedValue(null);
});

afterEach(() => {
  if (previousCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = previousCronSecret;
  }
});

async function route() {
  return import("@/app/api/internal/status/route");
}

describe("internal daily provider status", () => {
  it("requires the cron bearer secret", async () => {
    const { GET } = await route();
    const response = await GET(
      new Request("http://localhost/api/internal/status"),
    );

    expect(response.status).toBe(401);
  });

  it("reports cached state without resolving new provider content", async () => {
    manifestMocks.getCachedDailyLesson.mockImplementation(
      (category: string) =>
        category === "science"
          ? {
              date: "2026-07-25",
              category,
              term: "Entropy",
              definition: "A bounded fixture.",
              quote: { text: "A thought.", author: "Tester" },
              fact: "A fact.",
              sources: [
                {
                  label: "Wikipedia",
                  url: "https://en.wikipedia.org/wiki/Entropy",
                  license: "CC BY-SA 4.0",
                },
              ],
              provenance: {
                mode: "external",
                provider: "Wikimedia",
              },
            }
          : null,
    );
    const { GET } = await route();
    const response = await GET(
      new Request("http://localhost/api/internal/status", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    const body = (await response.json()) as {
      preparedManifest: boolean;
      categories: Array<{
        category: string;
        status: string;
        mode?: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.preparedManifest).toBe(false);
    expect(body.categories).toHaveLength(8);
    expect(
      body.categories.find((item) => item.category === "science"),
    ).toMatchObject({ status: "ready", mode: "external" });
    expect(
      body.categories.find((item) => item.category === "finance"),
    ).toMatchObject({ status: "not_generated" });
  });
});
