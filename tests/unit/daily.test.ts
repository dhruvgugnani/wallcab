import { describe, expect, it } from "vitest";
import {
  getFallbackLesson,
  hashString,
  toUtcDateKey,
} from "@/features/wallpaper/daily";
import { fallbackSeeds } from "@/features/wallpaper/fallback-content";
import { learningCategories } from "@/features/wallpaper/types";
import {
  normalizeLearningCategories,
  selectDailyCategory,
} from "@/features/wallpaper/preferences";

describe("daily fallback selection", () => {
  it("contains exactly 30 reviewed records per category", () => {
    for (const category of learningCategories) {
      expect(fallbackSeeds[category]).toHaveLength(30);
    }
  });

  it("provides a bounded pronunciation for every advanced vocabulary fallback", () => {
    for (const [, , , pronunciation] of fallbackSeeds.vocabulary) {
      expect(pronunciation).toMatch(/^\/.+\/$/);
      expect(pronunciation!.length).toBeLessThanOrEqual(50);
    }

    const lesson = getFallbackLesson(
      "vocabulary",
      new Date("2026-07-25T00:00:00Z"),
    );
    expect(lesson.pronunciation).toMatch(/^\/.+\/$/);
  });

  it("avoids introductory fallback topics in advanced daily rotation", () => {
    const introductoryTerms = new Set([
      "API",
      "Loop",
      "Budget",
      "Asset",
      "Atom",
      "Cell",
      "Gravity",
    ]);

    for (const category of ["coding", "finance", "science"] as const) {
      for (let day = 1; day <= 60; day += 1) {
        const lesson = getFallbackLesson(
          category,
          new Date(Date.UTC(2026, 7, day)),
        );
        expect(introductoryTerms.has(lesson.term)).toBe(false);
      }
    }
  });

  it("is deterministic for a category and UTC date", () => {
    const date = new Date("2026-07-25T23:59:00Z");
    expect(getFallbackLesson("science", date)).toEqual(
      getFallbackLesson("science", date),
    );
    expect(toUtcDateKey(date)).toBe("2026-07-25");
  });

  it("returns a stable unsigned hash", () => {
    expect(hashString("wallcab")).toBe(hashString("wallcab"));
    expect(hashString("wallcab")).toBeGreaterThanOrEqual(0);
  });

  it("normalizes a selected category set into taxonomy order", () => {
    expect(
      normalizeLearningCategories([
        "science",
        "vocabulary",
        "science",
        "coding",
      ]),
    ).toEqual(["vocabulary", "coding", "science"]);
  });

  it("selects one stable category per UTC day regardless of URL order", () => {
    const date = new Date("2026-07-25T12:00:00Z");
    const first = selectDailyCategory(
      ["science", "coding", "history", "finance", "psychology"],
      date,
    );
    const second = selectDailyCategory(
      ["psychology", "history", "science", "finance", "coding"],
      date,
    );

    expect(first).toBe(second);
    expect(
      ["science", "coding", "history", "finance", "psychology"],
    ).toContain(first);
  });

  it("gives every selected interest a turn across complete cycles", () => {
    const categories = [
      "vocabulary",
      "coding",
      "finance",
      "science",
      "history",
    ] as const;
    const selected = new Set(
      Array.from({ length: categories.length * 2 }, (_, offset) =>
        selectDailyCategory(
          categories,
          new Date(Date.UTC(2026, 6, 20 + offset)),
        ),
      ),
    );

    expect(selected).toEqual(new Set(categories));
  });
});
