# ADR 0003: Store MVP preferences only in the browser

- Status: accepted
- Date: 2026-07-25

## Context

Accounts and cross-device profiles would introduce personal data, authentication, database operations, deletion workflows, and an onboarding barrier for three small choices.

## Decision

Category, theme, and device size are stored in browser `localStorage`. The generated URL contains only those enumerated values. WallCab stores no user profile.

## Consequences

Preferences do not synchronize between browsers and disappear when site data is cleared. The product avoids an identity system and the Shortcut remains portable and inspectable.
