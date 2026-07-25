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
            definition: z.string(),
          }),
        ),
      }),
    ),
    sourceUrls: z.array(z.string()).optional(),
  }),
);

const datamuseSchema = z.array(
  z.object({
    word: z.string(),
    defs: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
).max(500);

const wikipediaSearchSchema = z.object({
  pages: z.array(
    z.object({
      title: z.string(),
      key: z.string(),
      description: z.string().nullable().optional(),
    }),
  ),
});

const wikipediaSchema = z.object({
  extract: z.string(),
  content_urls: z
    .object({
      desktop: z.object({ page: z.url() }),
    })
    .optional(),
});

const PROVIDER_TIMEOUT_MS = 2_800;
const MAX_PROVIDER_DEFINITION_LENGTH = 500;

class UnusableProviderContentError extends Error {}

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

function isUsableProviderText(
  value: string,
  minimum: number,
  maximum = MAX_PROVIDER_DEFINITION_LENGTH,
): boolean {
  const cleaned = cleanText(value, maximum + 1);
  return cleaned.length >= minimum && cleaned.length <= maximum;
}

function safeSourceUrl(values: string[] | undefined): string | undefined {
  return values?.find((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  });
}

function fallbackReason(
  error: unknown,
): NonNullable<DailyLesson["provenance"]["fallbackReason"]> {
  if (error instanceof UnusableProviderContentError) {
    return "unusable_content";
  }
  if (error instanceof z.ZodError) {
    return "invalid_response";
  }
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "provider_timeout";
  }
  return "provider_unavailable";
}

function logContentDecision(lesson: DailyLesson): void {
  const event = {
    event: "wallcab.content",
    date: lesson.date,
    category: lesson.category,
    term: lesson.term,
    mode: lesson.provenance.mode,
    provider: lesson.provenance.provider,
    fallbackReason: lesson.provenance.fallbackReason,
  };

  if (lesson.provenance.mode === "fallback") {
    console.warn(JSON.stringify(event));
  } else {
    console.info(JSON.stringify(event));
  }
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
    value.length <= 36 &&
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
    .map((entry) => ({
      ...entry,
      defs: entry.defs?.filter((definition) =>
        isUsableProviderText(splitDefinition(definition), 8),
      ),
    }))
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
    throw new UnusableProviderContentError(
      "Datamuse did not return a usable word",
    );
  }

  const payload = dictionarySchema.parse(
    await fetchProviderJson(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(selected.word.toLowerCase())}`,
    ),
  );
  const dictionaryDefinitions = payload[0]?.meanings
    .flatMap((meaning) =>
      meaning.definitions.map((item) => item.definition),
    )
    .filter((definition) => isUsableProviderText(definition, 8));
  const definition =
    dictionaryDefinitions?.[0] ?? splitDefinition(selected.defs[0]);
  const relatedSense =
    dictionaryDefinitions?.find((item) => item !== definition) ??
    selected.defs[1];

  const sourceUrl =
    safeSourceUrl(payload[0]?.sourceUrls) ??
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
    provenance: {
      mode: "external",
      provider: "Datamuse + Free Dictionary API",
    },
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
      page.key.trim().length > 0 &&
      isSafeConceptTitle(page.title) &&
      Boolean(page.description && page.description.length >= 12),
  );
  const selected =
    candidates[
      hashString(`${toUtcDateKey(date)}:${category}:external`) %
        candidates.length
    ];

  if (!selected?.description) {
    throw new UnusableProviderContentError(
      "Wikimedia did not return a usable concept",
    );
  }

  const title = selected.key.trim().replace(/\s+/g, "_");
  const payload = wikipediaSchema.parse(
    await fetchProviderJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    ),
  );
  if (!isUsableProviderText(payload.extract, 30, 2_000)) {
    throw new UnusableProviderContentError(
      "Wikimedia returned an unusable summary",
    );
  }
  const extract = cleanText(payload.extract, 176);

  if (/may refer to:/i.test(extract)) {
    throw new UnusableProviderContentError(
      "Wikimedia returned a disambiguation page",
    );
  }

  return {
    ...fallback,
    term: selected.title,
    definition: cleanText(selected.description, 150),
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
    provenance: {
      mode: "external",
      provider: "Wikimedia",
    },
  };
}

export async function getHybridDailyLesson(
  category: LearningCategory,
  date = new Date(),
): Promise<DailyLesson> {
  const fallback = getFallbackLesson(category, date);

  try {
    const lesson = category === "vocabulary"
      ? await fetchVocabularyLesson(fallback, date)
      : await fetchConceptLesson(category, fallback, date);
    logContentDecision(lesson);
    return lesson;
  } catch (error) {
    const lesson: DailyLesson = {
      ...fallback,
      provenance: {
        mode: "fallback",
        provider: "WallCab reviewed catalog",
        fallbackReason: fallbackReason(error),
      },
    };
    logContentDecision(lesson);
    return lesson;
  }
}
