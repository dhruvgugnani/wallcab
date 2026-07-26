# ADR 0003: Store MVP preferences only in the browser

- Status: accepted
- Date: 2026-07-25

## Context

Accounts and cross-device profiles would introduce personal data, authentication, database operations, deletion workflows, and an onboarding barrier for three small choices.

## Decision

Category, theme, device size, an optional personal note, and an optional
custom-background credential are stored in browser `localStorage`. The
generated Shortcut URL contains the enumerated preferences, the optional note,
and an opaque upload ID. Notes are capped at 80 characters, must not contain
sensitive information, and personalized final PNGs bypass the shared Worker
image cache. The separate private deletion link contains its secret after `#`;
that fragment is not included in normal page requests. WallCab stores no user
profile.

## Consequences

Preferences do not synchronize between browsers and disappear when site data
is cleared. A user must keep the separate deletion link if they clear browser
storage before deleting an upload. The product avoids an identity system and
the Shortcut remains portable and inspectable.
