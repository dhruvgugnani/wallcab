export const learningCategories = [
  "vocabulary",
  "coding",
  "finance",
  "stoicism",
  "science",
  "history",
  "psychology",
  "productivity",
] as const;

export const visualThemes = [
  "nature",
  "mountains",
  "ocean",
  "forest",
  "space",
  "amoled",
  "minimal",
  "abstract",
] as const;

export const devicePresets = ["standard", "air", "max"] as const;

export type LearningCategory = (typeof learningCategories)[number];
export type VisualTheme = (typeof visualThemes)[number];
export type DevicePreset = (typeof devicePresets)[number];

export type SourceAttribution = {
  label: string;
  url: string;
  license: string;
  creator?: string;
};

export type DailyLesson = {
  date: string;
  category: LearningCategory;
  term: string;
  definition: string;
  quote: {
    text: string;
    author: string;
  };
  fact: string;
  sources: SourceAttribution[];
};

export type BackgroundAttribution = SourceAttribution & {
  source: string;
};

export type BackgroundAsset = {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/svg+xml";
  attribution: BackgroundAttribution;
};

export type WallpaperRequest = {
  category: LearningCategory;
  theme: VisualTheme;
  size: DevicePreset;
};

export type WallpaperCacheRecord = WallpaperRequest & {
  key: string;
  date: string;
  etag: string;
  byteLength: number;
};

export type WallpaperOutput = WallpaperCacheRecord & {
  bytes: Uint8Array;
  lesson: DailyLesson;
  background: BackgroundAttribution;
};

export const deviceDimensions: Record<
  DevicePreset,
  { width: number; height: number; label: string }
> = {
  standard: {
    width: 1206,
    height: 2622,
    label: "iPhone 17 / 17 Pro",
  },
  air: {
    width: 1260,
    height: 2736,
    label: "iPhone Air",
  },
  max: {
    width: 1320,
    height: 2868,
    label: "iPhone 17 Pro Max",
  },
};

export const categoryLabels: Record<LearningCategory, string> = {
  vocabulary: "Vocabulary",
  coding: "Coding",
  finance: "Finance",
  stoicism: "Stoicism",
  science: "Science",
  history: "History",
  psychology: "Psychology",
  productivity: "Productivity",
};

export const themeLabels: Record<VisualTheme, string> = {
  nature: "Nature",
  mountains: "Mountains",
  ocean: "Ocean",
  forest: "Forest",
  space: "Space",
  amoled: "AMOLED",
  minimal: "Minimal",
  abstract: "Abstract",
};

export function isLearningCategory(value: string): value is LearningCategory {
  return learningCategories.includes(value as LearningCategory);
}

export function isVisualTheme(value: string): value is VisualTheme {
  return visualThemes.includes(value as VisualTheme);
}

export function isDevicePreset(value: string): value is DevicePreset {
  return devicePresets.includes(value as DevicePreset);
}
