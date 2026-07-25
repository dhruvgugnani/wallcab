# WallCab

WallCab turns an iPhone lock screen into one calm, source-credited lesson a day. A user chooses a learning category, visual theme, and device size; one stable API URL then works with a universal Apple Shortcut.

The production interface is always dark, account-free, and deliberately small. External providers select the daily word or concept. A reviewed 240-record catalog is used only when a provider fails validation or is unavailable.

## Product surface

- eight learning categories and eight visual themes;
- exact presets for iPhone 17/17 Pro, iPhone Air, and iPhone 17 Pro Max;
- deterministic daily selection by UTC date;
- source-validated Openverse imagery with procedural fallbacks;
- Sharp-rendered, indexed-palette PNGs capped at 2.2 MiB;
- signed Cloudflare Worker/KV cache with direct-generation fallback;
- complete Apple Shortcuts guide, public API docs, gallery, journal, sources, privacy, roadmap, RSS, OpenAPI, and SEO metadata.

## Stack

- Next.js 16.2.11 and React 19
- strict TypeScript and Tailwind CSS v4
- Sharp for image composition
- Cloudflare Workers and KV for active-day caching
- Vitest, Miniflare, Playwright, axe, and Lighthouse CI
- Vercel as the primary deployment target

Node.js 24.x and npm are required. Docker is documented as a future direction and is intentionally not included in the MVP.

## Local development

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Visit `http://localhost:3000`. Cache variables are optional locally; without them, `/api/wallpaper` renders and returns the first image directly.

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
GET /api/wallpaper?category=science&theme=space&size=max
HEAD /api/wallpaper?category=science&theme=space&size=max
```

Defaults are `vocabulary`, `nature`, and `standard`. A miss returns `200 image/png`; a hit may return a temporary `307` to a signed Worker asset. See the human-readable [API reference](src/app/docs/api/page.mdx) or `/openapi.json`.

## Repository map

```text
src/app/                 routes, metadata, docs, and journal
src/features/wallpaper/  shared taxonomy and reviewed fallback catalog
src/server/              providers, renderer, signing, cache client, cron
worker/                  Cloudflare Worker and KV implementation
tests/                   unit, integration, Miniflare, E2E, and visual checks
public/showcase/         permanent optimized WebP gallery studies
docs/                    deployment and architectural decisions
```

## Deployment

Read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before creating Worker or Vercel resources. The application works without the cache, which makes it safe to validate Vercel first, but the intended rollout order is Worker/KV, Vercel preview, preview approval, then the production domain.

The iCloud Shortcut download remains disabled until `NEXT_PUBLIC_SHORTCUT_URL` is provided.

## Licensing

WallCab code is MIT licensed. Third-party content, photographs, provider data, quotations, and fonts retain their original licenses. Fraunces and Manrope are distributed under the SIL Open Font License; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Created by Dhruv Gugnani.
