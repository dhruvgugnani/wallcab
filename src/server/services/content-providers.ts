import { z } from "zod";
import {
  getFallbackLesson,
  hashString,
  toUtcDateKey,
} from "@/features/wallpaper/daily";
import type {
  DailyLesson,
  LearningCategory,
} from "@/features/wallpaper/types";

const dictionarySchema = z.array(
  z.object({
    meanings: z.array(
      z.object({
        definitions: z.array(
          z.object({
            definition: z.string().min(8).max(500),
          }),
        ),
      }),
    ),
    sourceUrls: z.array(z.url()).optional(),
  }),
);

const datamuseSchema = z.array(
  z.object({
    word: z.string().min(3).max(40),
    defs: z.array(z.string().min(8).max(500)).optional(),
    tags: z.array(z.string()).optional(),
  }),
);

const wikipediaSearchSchema = z.object({
  pages: z.array(
    z.object({
      title: z.string().min(3).max(100),
      key: z.string().min(1),
      description: z.string().nullable().optional(),
    }),
  ),
});

const wikipediaSchema = z.object({
  extract: z.string().min(30).max(2_000),
  content_urls: z
    .object({
      desktop: z.object({ page: z.url() }),
    })
    .optional(),
});

const PROVIDER_TIMEOUT_MS = 2_800;

const topicQueryByCategory: Record<LearningCategory, string> = {
  vocabulary: "language learning curiosity",
  coding: "computer programming concepts",
  finance: "personal finance investing concepts",
  stoicism: "Stoic philosophy concepts",
  science: "important scientific concepts",
  history: "world history concepts events",
  psychology: "psychology concepts cognitive science",
  productivity: "productivity time management concepts",
};

function cleanText(value: string, maximum: number): string {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maximum) {
    return normalized;
  }

  const clipped = normalized.slice(0, maximum - 1);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf(";"),
  );
  return `${clipped.slice(0, sentenceEnd > maximum * 0.55 ? sentenceEnd + 1 : maximum - 1).trim()}…`;
}

async function fetchProviderJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WallCab/1.0 (+https://wallcab.dhruvdev.me)",
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Provider returned ${response.status}`);
  }

  return response.json();
}

function splitDefinition(value: string): string {
  const separator = value.indexOf("\t");
  return separator >= 0 ? value.slice(separator + 1) : value;
}

function isSafeConceptTitle(value: string): boolean {
  return (
    value.length <= 42 &&
    !/^(list of|outline of|category:|template:|portal:)/i.test(value) &&
    !/[<>{}[\]|]/.test(value)
  );
}

async function fetchVocabularyLesson(
  fallback: DailyLesson,
  date: Date,
): Promise<DailyLesson> {
  const query = new URLSearchParams({
    ml: "curiosity knowledge learning",
    topics: "language,ideas,thought",
    md: "dp",
    max: "500",
    v: "enwiki",
  });
  const words = datamuseSchema
    .parse(
      await fetchProviderJson(
        `https://api.datamuse.com/words?${query.toString()}`,
      ),
    )
    .filter(
      (entry) =>
        /^[a-z-]+$/i.test(entry.word) &&
        entry.word.length >= 5 &&
        entry.word.length <= 16 &&
        (entry.defs?.length ?? 0) > 0,
    );
  const selected =
    words[
      hashString(`${toUtcDateKey(date)}:vocabulary:external`) % words.length
    ];

  if (!selected?.defs?.[0]) {
    throw new Error("Datamuse did not return a usable word");
  }

  const payload = dictionarySchema.parse(
    await fetchProviderJson(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(selected.word.toLowerCase())}`,
    ),
  );
  const dictionaryDefinitions = payload[0]?.meanings.flatMap((meaning) =>
    meaning.definitions.map((item) => item.definition),
  );
  const definition =
    dictionaryDefinitions?.[0] ?? splitDefinition(selected.defs[0]);
  const relatedSense =
    dictionaryDefinitions?.find((item) => item !== definition) ??
    selected.defs[1];

  const sourceUrl =
    payload[0]?.sourceUrls?.[0] ??
    `https://en.wiktionary.org/wiki/${encodeURIComponent(selected.word)}`;

  return {
    ...fallback,
    term: selected.word.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    definition: cleanText(definition, 190),
    fact: relatedSense
      ? `Another recorded sense: ${cleanText(splitDefinition(relatedSense), 160)}`
      : `Datamuse connected this word to today’s theme of curiosity and learning.`,
    sources: [
      {
        label: "Datamuse + Free Dictionary API",
        url: sourceUrl,
        license: "Wiktionary / WordNet source licenses apply",
      },
      ...fallback.sources.slice(1),
    ],
  };
}

async function fetchConceptLesson(
  category: Exclude<LearningCategory, "vocabulary">,
  fallback: DailyLesson,
  date: Date,
): Promise<DailyLesson> {
  const searchQuery = new URLSearchParams({
    q: topicQueryByCategory[category],
    limit: "100",
  });
  const search = wikipediaSearchSchema.parse(
    await fetchProviderJson(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?${searchQuery.toString()}`,
    ),
  );
  const candidates = search.pages.filter(
    (page) =>
      isSafeConceptTitle(page.title) &&
      Boolean(page.description && page.description.length >= 12),
  );
  const selected =
    candidates[
      hashString(`${toUtcDateKey(date)}:${category}:external`) %
        candidates.length
    ];

  if (!selected?.description) {
    throw new Error("Wikimedia did not return a usable concept");
  }

  const title = selected.key.trim().replace(/\s+/g, "_");
  const payload = wikipediaSchema.parse(
    await fetchProviderJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    ),
  );
  const extract = cleanText(payload.extract, 210);

  if (/may refer to:/i.test(extract)) {
    throw new Error("Wikimedia returned a disambiguation page");
  }

  return {
    ...fallback,
    term: selected.title,
    definition: cleanText(selected.description, 175),
    fact: extract,
    sources: [
      {
        label: "Wikipedia",
        url:
          payload.content_urls?.desktop.page ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        license: "CC BY-SA 4.0",
      },
      ...fallback.sources.slice(1),
    ],
  };
}

export async function getHybridDailyLesson(
  category: LearningCategory,
  date = new Date(),
): Promise<DailyLesson> {
  const fallback = getFallbackLesson(category, date);

  try {
    return category === "vocabulary"
      ? await fetchVocabularyLesson(fallback, date)
      : await fetchConceptLesson(category, fallback, date);
  } catch {
    return fallback;
  }
}
