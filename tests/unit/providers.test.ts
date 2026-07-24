import { afterEach, describe, expect, it, vi } from "vitest";
import { fallbackSeeds } from "@/features/wallpaper/fallback-content";
import { getHybridDailyLesson } from "@/server/services/content-providers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API-first daily lessons", () => {
  it("selects the vocabulary word from external APIs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          {
            word: "perspicacious",
            defs: ["adj\tHaving a ready insight into things"],
            tags: ["adj"],
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json([
          {
            meanings: [
              {
                definitions: [
                  { definition: "Having a ready insight into things." },
                  { definition: "Clear-sighted and discerning." },
                ],
              },
            ],
            sourceUrls: ["https://en.wiktionary.org/wiki/perspicacious"],
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const lesson = await getHybridDailyLesson(
      "vocabulary",
      new Date("2026-07-25T00:00:00Z"),
    );

    expect(lesson.term).toBe("Perspicacious");
    expect(lesson.definition).toContain("ready insight");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("selects a non-vocabulary concept from Wikimedia", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          pages: [
            {
              title: "Memoization",
              key: "Memoization",
              description: "Optimization by storing previous results",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          extract:
            "Memoization stores the results of expensive operations so later calls can reuse them.",
          content_urls: {
            desktop: {
              page: "https://en.wikipedia.org/wiki/Memoization",
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const lesson = await getHybridDailyLesson(
      "coding",
      new Date("2026-07-25T00:00:00Z"),
    );

    expect(lesson.term).toBe("Memoization");
    expect(lesson.definition).toContain("storing previous results");
  });

  it("uses curated records only when a provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const lesson = await getHybridDailyLesson(
      "finance",
      new Date("2026-07-25T00:00:00Z"),
    );

    expect(fallbackSeeds.finance.some(([term]) => term === lesson.term)).toBe(
      true,
    );
  });
});
