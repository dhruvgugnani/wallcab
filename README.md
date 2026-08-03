# WallCab

[Website](https://wallcab.dhruvdev.me) · [Install the iPhone Shortcut](https://www.icloud.com/shortcuts/1ca82c739d3f44ffb448ca2f44b4869b) · [Installation guide](https://wallcab.dhruvdev.me/install) · [API documentation](https://wallcab.dhruvdev.me/docs/api)

WallCab turns an iPhone lock screen into one calm, source-credited lesson a day. A user chooses one or more learning interests, a visual theme or private custom background, a device size, and optionally a short personal note; one stable API URL then works with a universal Apple Shortcut.

The production interface is always dark, account-free, and deliberately small. External providers select the daily word or concept. A reviewed 240-record catalog is used only when a provider fails validation or is unavailable.

## Product surface

- eight learning categories and eleven visual themes;
- exact presets for iPhone 17/17 Pro, iPhone Air, and iPhone 17 Pro Max;
- deterministic, fair daily rotation across the user’s selected interests;
- advanced provider-discovered words and concepts, with IPA pronunciation on
  every vocabulary wallpaper;
- five daily Openverse photo themes, six fixed WallCab Original SVG themes,
  and procedural photo fallbacks;
- optional private custom backgrounds protected by Turnstile, normalized by
  Sharp, stored in Workers KV, and removed after 30 inactive days;
- Sharp-rendered, indexed-palette PNGs capped at 2.2 MiB;
- signed Cloudflare Worker/KV cache with direct-generation fallback;
- anonymous Analytics Engine counters for valid automation runs;
- optional Razorpay project support with a signed, database-free Resend
  thank-you email;
- complete Apple Shortcuts guide, public API docs, gallery, journal, sources, privacy, roadmap, RSS, OpenAPI, and SEO metadata.

## Stack

- Next.js 16.2.11 and React 19
- strict TypeScript and Tailwind CSS v4
- Sharp for image composition
- Cloudflare Workers, KV, and Analytics Engine for caching, private uploads,
  and anonymous run counters
- Vitest, Miniflare, Playwright, axe, and Lighthouse CI
- Vercel as the primary deployment target

Node.js 24.x and npm are required. Docker is documented as a future direction and is intentionally not included in the MVP.

## Local development

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Visit `http://localhost:3000`. Cache variables are optional locally; without them, `/api/wallpaper` renders and returns the first image directly. Custom uploads require the Worker KV binding and Turnstile variables. Cloudflare's public test keys can be used only for local development; production must use a real widget restricted to the WallCab domains.

Generate the permanent gallery studies after changing their source template:

```powershell
npm.cmd run assets:showcase
```

## Verification

```powershell
npm.cmd run audit
npm.cmd run check
npm.cmd run test:e2e
npm.cmd run lighthouse
```

`test:e2e` creates a production build before running desktop and mobile browser tests. CI installs Chromium and executes every gate above.

## Public API

```http
GET /api/wallpaper?categories=science,history,psychology&theme=space&size=max
HEAD /api/wallpaper?categories=science,history,psychology&theme=space&size=max
GET /api/wallpaper/status?categories=science,history,psychology&theme=space&size=max
GET /api/wallpaper?categories=vocabulary&theme=minimal&size=standard&note=Property%20of%20Dhruv
```

`categories` accepts between one and eight comma-separated interests. WallCab chooses one of them for the UTC day, stores the accepted lesson for that day, and reports its source through the status endpoint and `X-WallCab-Content-*` headers. Defaults are `vocabulary`, `nature`, and `standard`. The replaced singular `category` parameter returns `400`.

`note` is optional and accepts up to 80 characters. It replaces the lower fact
section with a `PERSONAL NOTE` section; leaving it blank removes that section
entirely. The note is saved only in browser preferences and the copied
Shortcut URL. Because URL query values may appear in hosting request logs, it
must not contain sensitive information. Personalized final PNGs bypass the
shared Worker image cache.

The homepage can upload an optional JPEG, PNG, or WebP. Its returned opaque ID
adds `background=<id>` to the same daily URL. Raw files are private, upload
metadata is stripped, the deletion secret stays after `#` in a private link,
and a missing or expired upload safely falls back to the selected built-in
theme. Existing URLs remain unchanged.

A wallpaper miss returns `200 image/png`; a hit may return a temporary `307` to a signed Worker asset. Personalized notes return `200` with `X-WallCab-Cache: BYPASS`. See the human-readable [API reference](src/app/docs/api/page.mdx) or `/openapi.json`.

Valid wallpaper GET requests emit one anonymous run event after the response.
Preview, status, HEAD, invalid, rate-limited, cron, and internal cache traffic
is excluded. Events contain operational enums and a random per-request ID, not
an IP address, user agent, complete URL, note, custom-background ID, or
persistent client identifier. Analytics read credentials and reporting UI
belong only to the separate private wallcab-admin deployment.

## Optional project support

WallCab can link to a live INR Razorpay Payment Page. After a successful
payment, Razorpay signs a `payment.captured` webhook and the server sends one
branded thank-you through Resend. The Razorpay payment ID is used as Resend's
24-hour idempotency key, matching Razorpay's retry window without adding a
database.

The payment page URL, account ID, webhook secret, Resend key, and sender are
server-only Vercel environment values. The webhook validates the untouched
request body, expected merchant account, captured state, domestic flag, INR
currency, amount, payment ID, and supporter email before sending. WallCab does
not log or store the email address or phone number. The support interface stays
absent when `SUPPORT_URL` is empty or invalid. See
[the deployment runbook](docs/DEPLOYMENT.md) for the exact setup.

## Repository map

```text
src/app/                 routes, metadata, docs, and journal
src/features/wallpaper/  shared taxonomy and reviewed fallback catalog
src/server/              providers, renderer, signing, support email, cache, cron
worker/                  Worker cache, uploads, analytics ingest, and cleanup
tests/                   unit, integration, Miniflare, E2E, and visual checks
public/showcase/         permanent optimized WebP gallery studies
docs/                    deployment and architectural decisions
```

## Deployment

Read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before creating Worker or Vercel resources. The application works without the cache, which makes it safe to validate Vercel first, but the intended rollout order is Worker/KV, Vercel preview, preview approval, then the production domain.

The public iCloud Shortcut is configured by default. Keep
`NEXT_PUBLIC_SHORTCUT_URL=https://www.icloud.com/shortcuts/1ca82c739d3f44ffb448ca2f44b4869b`
in Vercel so a later Shortcut revision can be promoted without changing the
interface code.

## Licensing

WallCab code is MIT licensed. Third-party content, photographs, provider data, quotations, and fonts retain their original licenses. Fraunces, Manrope, and Noto Sans are distributed under the SIL Open Font License; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Created by Dhruv Gugnani.
