# ADR 0001: External-first lessons with reviewed atomic fallbacks

- Status: accepted
- Date: 2026-07-25

## Context

WallCab needs fresh daily material without a database, paid content service, or unsafe random-quote feed. Provider failures must not leave Apple Shortcuts without an image.

## Decision

Vocabulary terms come from Datamuse and are enriched through Free Dictionary. Other concepts come from Wikimedia search and page summaries. Every response is validated for structure, source, language, length, duplication risk, and composition fit.

When any provider step fails, WallCab uses one complete reviewed record from a 30-item-per-category local catalog. Provider and fallback fields are never mixed. Themes and device sizes do not alter the selected daily lesson.

## Consequences

Healthy providers determine the actual daily word or concept. The repository retains 240 reviewed records as continuity infrastructure. A future Datamuse API-key requirement can be handled at the provider boundary without changing public wallpaper URLs.
