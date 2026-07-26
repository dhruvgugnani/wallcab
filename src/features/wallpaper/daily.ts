import type {
  DailyLesson,
  LearningCategory,
  SourceAttribution,
} from "@/features/wallpaper/types";
import {
  fallbackSeeds,
  lessonQuotes,
  quoteSource,
  sourceByCategory,
} from "@/features/wallpaper/fallback-content";
import {
  hashString,
  toUtcDateKey,
} from "@/features/wallpaper/preferences";

export { hashString, toUtcDateKey } from "@/features/wallpaper/preferences";

const advancedFallbackIndexes: Record<
  LearningCategory,
  readonly number[]
> = {
  vocabulary: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  ],
  coding: [1, 4, 5, 6, 9, 12, 13, 14, 15, 16, 18, 19, 20, 23, 24, 25, 28],
  finance: [0, 2, 4, 9, 10, 15, 16, 17, 19, 22, 25, 26, 27, 28, 29],
  stoicism: [0, 3, 5, 6, 12, 13, 14, 15, 17, 18, 19, 20, 21, 25, 29],
  science: [8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 28, 29],
  history: [0, 2, 4, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
  psychology: [0, 1, 2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29],
  productivity: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 19, 20, 22, 24, 25, 26, 28, 29],
};

export function getFallbackLesson(
  category: LearningCategory,
  date = new Date(),
): DailyLesson {
  const dateKey = toUtcDateKey(date);
  const seeds = fallbackSeeds[category];
  const advancedIndexes = advancedFallbackIndexes[category];
  const advancedSlot =
    hashString(`${dateKey}:${category}`) % advancedIndexes.length;
  const index = advancedIndexes[advancedSlot] ?? 0;
  const seed = seeds[index];
  const quote = lessonQuotes[index % lessonQuotes.length];

  if (!seed || !quote) {
    throw new Error(`Missing fallback content for ${category}`);
  }

  const source: SourceAttribution = sourceByCategory[category];

  return {
    date: dateKey,
    category,
    term: seed[0],
    pronunciation: seed[3],
    definition: seed[1],
    fact: seed[2],
    quote: {
      text: quote[0],
      author: quote[1],
    },
    sources: [source, quoteSource],
    provenance: {
      mode: "fallback",
      provider: "WallCab reviewed catalog",
      fallbackReason: "unusable_content",
    },
  };
}

export function getNextUtcDate(now = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    ),
  );
}

export function getNextUtcRollover(now = new Date()): number {
  return Math.floor(getNextUtcDate(now).getTime() / 1000);
}
