import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({
  getPrivateCacheValue: vi.fn(),
  putCacheValue: vi.fn(),
}));

const providerMocks = vi.hoisted(() => ({
  getHybridDailyLesson: vi.fn(),
}));

vi.mock("@/server/cache/client", () => cacheMocks);
vi.mock("@/server/services/content-providers", () => providerMocks);
vi.mock("@/server/services/background-provider", () => ({
  getBackgroundAsset: vi.fn(),
}));

const lesson = {
  date: "2026-07-25",
  category: "science" as const,
  term: "Entropy",
  definition: "A measure associated with possible system states.",
  quote: { text: "A bounded thought.", author: "Tester" },
  fact: "The fixture remains within the composition.",
  sources: [
    {
      label: "Wikipedia",
      url: "https://en.wikipedia.org/wiki/Entropy",
      license: "CC BY-SA 4.0",
    },
  ],
  provenance: {
    mode: "external" as const,
    provider: "Wikimedia",
  },
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  cacheMocks.putCacheValue.mockResolvedValue(true);
  providerMocks.getHybridDailyLesson.mockResolvedValue(lesson);
});

async function manifestModule() {
  return import("@/server/daily-manifest");
}

describe("active-day lesson cache", () => {
  it("reuses a validated daily lesson without another provider call", async () => {
    cacheMocks.getPrivateCacheValue.mockResolvedValue(
      Response.json(lesson),
    );
    const { resolveDailyLesson } = await manifestModule();

    const result = await resolveDailyLesson(
      "science",
      new Date("2026-07-25T12:00:00Z"),
      null,
    );

    expect(result).toEqual(lesson);
    expect(providerMocks.getHybridDailyLesson).not.toHaveBeenCalled();
  });

  it("stores a newly accepted lesson until the UTC rollover", async () => {
    cacheMocks.getPrivateCacheValue.mockResolvedValue(null);
    const { resolveDailyLesson } = await manifestModule();

    const result = await resolveDailyLesson(
      "science",
      new Date("2026-07-25T12:00:00Z"),
      null,
    );

    expect(result).toEqual(lesson);
    expect(providerMocks.getHybridDailyLesson).toHaveBeenCalledTimes(1);
    expect(cacheMocks.putCacheValue).toHaveBeenCalledWith(
      "lesson/v4/2026-07-25/science.json",
      expect.anything(),
      "application/json",
      1_785_024_000,
    );
  });
});
