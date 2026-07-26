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
            word: "dna",
            defs: [`n\t${"x".repeat(688)}`],
            tags: ["n"],
          },
          {
            word: "perspicacious",
            defs: ["adj\tHaving a ready insight into things"],
            tags: [
              "adj",
              "f:0.08",
              "pron:P ER S P IH K EY SH AH S",
              "ipa_pron:pɜː.spɪˈkeɪ.ʃəs",
            ],
            numSyllables: 4,
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json([
          {
            phonetic: "/ˌpɜː.spɪˈkeɪ.ʃəs/",
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
    expect(lesson.pronunciation).toBe("/ˌpɜː.spɪˈkeɪ.ʃəs/");
    expect(lesson.definition).toContain("ready insight");
    expect(lesson.fact).toContain("4-syllable adjective");
    expect(lesson.fact).toContain(
      "0.08 occurrences per million words",
    );
    expect(lesson.fact).not.toContain("Another recorded sense");
    expect(lesson.provenance).toEqual({
      mode: "external",
      provider: "Datamuse + Free Dictionary API",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const datamuseUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(datamuseUrl.searchParams.get("md")).toBe("dpsrf");
    expect(datamuseUrl.searchParams.get("ipa")).toBe("1");
    expect(datamuseUrl.searchParams.has("v")).toBe(false);
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
    expect(lesson.provenance.mode).toBe("external");
    expect(lesson.provenance.provider).toBe("Wikimedia");
    expect(
      decodeURIComponent(fetchMock.mock.calls[0]![0] as string),
    ).not.toContain("computer programming concepts");
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
    expect(lesson.provenance).toMatchObject({
      mode: "fallback",
      provider: "WallCab reviewed catalog",
      fallbackReason: "provider_unavailable",
    });
  });

  it("uses Datamuse IPA when Free Dictionary has no pronunciation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          {
            word: "perspicacious",
            defs: ["adj\tHaving a ready insight into things"],
            tags: [
              "adj",
              "f:0.08",
              "pron:P ER S P IH K EY SH AH S",
              "ipa_pron:pɜː.spɪˈkeɪ.ʃəs",
            ],
            numSyllables: 4,
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
                ],
              },
            ],
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const lesson = await getHybridDailyLesson(
      "vocabulary",
      new Date("2026-07-25T00:00:00Z"),
    );

    expect(lesson.provenance.mode).toBe("external");
    expect(lesson.pronunciation).toBe("/pɜː.spɪˈkeɪ.ʃəs/");
  });

  it("keeps valid Datamuse content when a rare word is missing from Free Dictionary", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          {
            word: "lexigraphy",
            defs: ["n\tThe representation of words in writing."],
            tags: [
              "n",
              "f:0.000000",
              "ipa_pron:ɫˈɛksɪgrʌfi",
            ],
            numSyllables: 4,
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json(
          { title: "No Definitions Found" },
          { status: 404 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const lesson = await getHybridDailyLesson(
      "vocabulary",
      new Date("2026-07-26T00:00:00Z"),
    );

    expect(lesson).toMatchObject({
      term: "Lexigraphy",
      pronunciation: "/ɫˈɛksɪgrʌfi/",
      definition: "The representation of words in writing.",
      fact: expect.stringContaining(
        "below 0.01 occurrences per million words",
      ),
      provenance: {
        mode: "external",
        provider: "Datamuse",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses an advanced fallback when pronunciation metadata is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          {
            word: "perspicacious",
            defs: ["adj\tHaving a ready insight into things"],
            tags: ["adj", "f:0.08"],
            numSyllables: 4,
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
                ],
              },
            ],
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const lesson = await getHybridDailyLesson(
      "vocabulary",
      new Date("2026-07-25T00:00:00Z"),
    );

    expect(lesson.provenance).toMatchObject({
      mode: "fallback",
      fallbackReason: "unusable_content",
    });
    expect(lesson.pronunciation).toMatch(/^\/.+\/$/);
  });
});
