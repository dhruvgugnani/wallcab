import {
  learningCategories,
  type LearningCategory,
} from "@/features/wallpaper/types";

const MILLISECONDS_PER_DAY = 86_400_000;

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

export function normalizeLearningCategories(
  categories: readonly LearningCategory[],
): LearningCategory[] {
  const selected = new Set(categories);
  return learningCategories.filter((category) => selected.has(category));
}

export function selectDailyCategory(
  categories: readonly LearningCategory[],
  date = new Date(),
): LearningCategory {
  const normalized = normalizeLearningCategories(categories);
  if (normalized.length === 0) {
    throw new Error("At least one learning category is required");
  }
  if (normalized.length === 1) {
    return normalized[0]!;
  }

  const dayNumber = Math.floor(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ) / MILLISECONDS_PER_DAY,
  );
  const cycle = Math.floor(dayNumber / normalized.length);
  const slot = dayNumber % normalized.length;
  const selectionKey = normalized.join(",");
  const shuffled = normalized.toSorted(
    (left, right) =>
      hashString(`${selectionKey}:${cycle}:${left}`) -
      hashString(`${selectionKey}:${cycle}:${right}`),
  );

  return shuffled[slot]!;
}
