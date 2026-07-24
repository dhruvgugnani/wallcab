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

export function toUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getFallbackLesson(
  category: LearningCategory,
  date = new Date(),
): DailyLesson {
  const dateKey = toUtcDateKey(date);
  const seeds = fallbackSeeds[category];
  const index = hashString(`${dateKey}:${category}`) % seeds.length;
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
    definition: seed[1],
    fact: seed[2],
    quote: {
      text: quote[0],
      author: quote[1],
    },
    sources: [source, quoteSource],
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
