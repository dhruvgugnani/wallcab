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
    phonetic: z.string().optional(),
    phonetics: z
      .array(
        z.object({
          text: z.string().optional(),
        }),
      )
      .optional(),
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
    score: z.number().optional(),
    defs: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    numSyllables: z.number().int().positive().optional(),
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

const vocabularyPrompts = [
  {
    meaning: "a subtle precise intellectual concept",
    topics: "philosophy,language,knowledge,reason,thought",
  },
  {
    meaning: "difficult to understand or deliberately obscure",
    topics: "rhetoric,language,argument,meaning,logic",
  },
  {
    meaning: "showing unusual insight judgment or perception",
    topics: "character,wisdom,perception,reason,analysis",
  },
  {
    meaning: "a complex state of change uncertainty or transition",
    topics: "change,time,identity,experience,uncertainty",
  },
  {
    meaning: "interpretation of texts symbols or ideas",
    topics: "language,meaning,culture,philosophy,criticism",
  },
  {
    meaning: "an exact description of beauty sound or atmosphere",
    topics: "aesthetics,beauty,sound,perception,experience",
  },
] as const;

const topicQueriesByCategory: Record<
  Exclude<LearningCategory, "vocabulary">,
  readonly string[]
> = {
  coding: [
    "distributed consensus algorithms",
    "type theory programming languages",
    "concurrency control computer science",
    "cryptographic protocol concepts",
    "compiler optimization techniques",
    "formal verification software",
  ],
  finance: [
    "financial market microstructure",
    "derivatives pricing concepts",
    "portfolio risk theory",
    "behavioral finance anomalies",
    "fixed income duration convexity",
    "systemic financial risk",
  ],
  stoicism: [
    "Stoic prohairesis moral psychology",
    "Stoic oikeiosis ethics",
    "Stoic theory of impressions assent",
    "Stoic cosmopolitanism philosophy",
    "Stoic preferred indifferents",
    "Stoic discipline of desire",
  ],
  science: [
    "quantum field theory concepts",
    "statistical thermodynamics concepts",
    "molecular biology regulatory mechanisms",
    "cosmology dark matter concepts",
    "neuroscience predictive processing",
    "complex systems emergence science",
  ],
  history: [
    "historiography historical methodology",
    "postcolonial history concepts",
    "political economy historical systems",
    "global intellectual history",
    "state formation comparative history",
    "environmental history concepts",
  ],
  psychology: [
    "metacognition cognitive science",
    "predictive processing psychology",
    "psychometrics measurement theory",
    "memory reconsolidation neuroscience",
    "dual process theory cognition",
    "social cognition attribution theory",
  ],
  productivity: [
    "cognitive load knowledge work",
    "decision theory prioritization",
    "deliberate practice expertise",
    "systems thinking work management",
    "attention residue task switching",
    "implementation intentions behavior change",
  ],
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

function metadataNumber(
  tags: string[] | undefined,
  prefix: string,
): number | undefined {
  const value = tags?.find((tag) => tag.startsWith(prefix))?.slice(
    prefix.length,
  );
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePronunciation(
  ...values: Array<string | undefined>
): string | undefined {
  const value = values
    .map((candidate) => candidate?.replace(/\s+/g, " ").trim())
    .find(
      (candidate) =>
        candidate &&
        candidate.length >= 3 &&
        candidate.length <= 48 &&
        !/[<>{}\u0000-\u001f\u007f]/.test(candidate),
    );
  if (!value) return undefined;
  const slashWrapped = value.startsWith("/") && value.endsWith("/");
  const bracketWrapped = value.startsWith("[") && value.endsWith("]");
  const unwrapped =
    slashWrapped || bracketWrapped
      ? value.slice(1, -1)
      : value.replace(/^[\/\[]/, "").replace(/[\/\]]$/, "");
  if (unwrapped.length < 2 || !/\p{L}/u.test(unwrapped)) {
    return undefined;
  }
  return bracketWrapped ? `[${unwrapped}]` : `/${unwrapped}/`;
}

function isAdvancedVocabularyCandidate(entry: {
  word: string;
  tags?: string[];
  numSyllables?: number;
}): boolean {
  const frequency = metadataNumber(entry.tags, "f:");
  const complexEnough =
    (entry.numSyllables ?? 0) >= 3 || entry.word.length >= 11;
  const uncommonEnough = frequency === undefined || frequency <= 8;

  return complexEnough && uncommonEnough;
}

function vocabularyFact(entry: {
  word: string;
  tags?: string[];
  numSyllables?: number;
}): string {
  const partOfSpeechByTag: Record<string, string> = {
    adj: "adjective",
    adv: "adverb",
    n: "noun",
    v: "verb",
  };
  const partOfSpeech = entry.tags
    ?.map((tag) => partOfSpeechByTag[tag])
    .find(Boolean);
  const syllableDetail = entry.numSyllables
    ? `${entry.numSyllables}-syllable${partOfSpeech ? ` ${partOfSpeech}` : " word"}`
    : partOfSpeech ?? "word";
  const frequency = metadataNumber(entry.tags, "f:");

  if (frequency !== undefined) {
    const frequencyLabel =
      frequency < 0.01
        ? "below 0.01"
        : new Intl.NumberFormat("en-US", {
            minimumFractionDigits: frequency < 1 ? 2 : 0,
            maximumFractionDigits: frequency < 1 ? 2 : 1,
          }).format(frequency);
    return cleanText(
      `Datamuse tags this as a ${syllableDetail} and reports a corpus frequency ${frequencyLabel} occurrences per million words.`,
      176,
    );
  }

  const letters = entry.word.replace(/[^a-z]/gi, "").length;
  return cleanText(
    `The spelling contains ${letters} letters, and Datamuse tags it as a ${syllableDetail}.`,
    176,
  );
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
  const dateKey = toUtcDateKey(date);
  const prompt =
    vocabularyPrompts[
      hashString(`${dateKey}:vocabulary:prompt`) %
        vocabularyPrompts.length
    ]!;
  const query = new URLSearchParams({
    ml: prompt.meaning,
    topics: prompt.topics,
    md: "dpsrf",
    ipa: "1",
    max: "500",
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
        entry.word.length >= 8 &&
        entry.word.length <= 18 &&
        isAdvancedVocabularyCandidate(entry) &&
        (entry.defs?.length ?? 0) > 0,
    );
  const selected =
    words[
      hashString(`${dateKey}:vocabulary:external`) % words.length
    ];

  if (!selected?.defs?.[0]) {
    throw new UnusableProviderContentError(
      "Datamuse did not return a usable word",
    );
  }

  let payload: z.infer<typeof dictionarySchema> = [];
  try {
    payload = dictionarySchema.parse(
      await fetchProviderJson(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(selected.word.toLowerCase())}`,
      ),
    );
  } catch {
    // Datamuse already supplies a definition and IPA for valid candidates.
    // Free Dictionary is useful enrichment, but rare words often return 404.
  }
  const dictionaryDefinitions = payload[0]?.meanings
    .flatMap((meaning) =>
      meaning.definitions.map((item) => item.definition),
    )
    .filter((definition) => isUsableProviderText(definition, 8)) ?? [];
  const definition =
    dictionaryDefinitions?.[0] ?? splitDefinition(selected.defs[0]);
  const dictionaryPronunciations = payload.flatMap((entry) => [
    entry.phonetic,
    ...(entry.phonetics?.map((phonetic) => phonetic.text) ?? []),
  ]);
  const datamusePronunciation =
    selected.tags
      ?.find((tag) => tag.startsWith("ipa_pron:"))
      ?.slice("ipa_pron:".length) ??
    selected.tags
      ?.find((tag) => tag.startsWith("pron:"))
      ?.slice("pron:".length);
  const pronunciation = normalizePronunciation(
    ...dictionaryPronunciations,
    datamusePronunciation,
  );
  if (!pronunciation) {
    throw new UnusableProviderContentError(
      "Vocabulary provider did not return a usable pronunciation",
    );
  }

  const sourceUrl =
    safeSourceUrl(payload[0]?.sourceUrls) ??
    `https://en.wiktionary.org/wiki/${encodeURIComponent(selected.word)}`;
  const dictionaryEnriched =
    dictionaryDefinitions.length > 0 ||
    dictionaryPronunciations.some(Boolean) ||
    Boolean(safeSourceUrl(payload[0]?.sourceUrls));
  const provider = dictionaryEnriched
    ? "Datamuse + Free Dictionary API"
    : "Datamuse";

  return {
    ...fallback,
    term: selected.word.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    pronunciation,
    definition: cleanText(definition, 190),
    fact: vocabularyFact(selected),
    sources: [
      {
        label: provider,
        url: sourceUrl,
        license: "Datamuse / Wiktionary / WordNet source licenses apply",
      },
      ...fallback.sources.slice(1),
    ],
    provenance: {
      mode: "external",
      provider,
    },
  };
}

async function fetchConceptLesson(
  category: Exclude<LearningCategory, "vocabulary">,
  fallback: DailyLesson,
  date: Date,
): Promise<DailyLesson> {
  const dateKey = toUtcDateKey(date);
  const prompts = topicQueriesByCategory[category];
  const prompt =
    prompts[
      hashString(`${dateKey}:${category}:prompt`) % prompts.length
    ]!;
  const searchQuery = new URLSearchParams({
    q: prompt,
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
      hashString(`${dateKey}:${category}:external`) %
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
