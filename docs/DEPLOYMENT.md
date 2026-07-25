# Deployment runbook

WallCab uses Cloudflare Workers/KV for the active-day image cache and Vercel for the website, provider pipeline, renderer, and scheduled rollover. The Worker should be deployed first so a Vercel preview can exercise both hit and miss paths.

Creating external resources changes account state. Run these commands only in the intended Cloudflare and Vercel accounts.

## 1. Verify locally

```powershell
npm.cmd ci
npm.cmd run audit
npm.cmd run check
npm.cmd run test:e2e
```

The installed Node version must be 24.x. Do not deploy when the lockfile audit, Worker type check, image ceiling, build, or browser tests fail.

## 2. Create Workers KV

Confirm the active Cloudflare identity:

```powershell
npx.cmd wrangler whoami
```

Create the namespace:

```powershell
npx.cmd wrangler kv namespace create WALLPAPERS
```

Copy the exact opaque namespace ID into `worker/wrangler.jsonc`. Do not derive or reformat it.

Generate two independent high-entropy values, then store them:

```powershell
npx.cmd wrangler secret put CACHE_WORKER_SECRET --config worker/wrangler.jsonc
npx.cmd wrangler secret put CACHE_SIGNING_SECRET --config worker/wrangler.jsonc
```

Deploy and save the returned `https://...workers.dev` origin:

```powershell
npm.cmd run worker:deploy
```

Verify an unsigned public request returns `401`, an unknown route returns `404`, and the response security headers are present.

## 3. Create the Vercel preview

Confirm the active identity:

```powershell
npx.cmd vercel whoami
```

Link only this repository directory, not its parent workspace. Configure:

```text
NEXT_PUBLIC_SITE_URL=<preview origin while validating>
CACHE_WORKER_URL=<exact Worker origin>
CACHE_WORKER_SECRET=<same private HMAC value>
CACHE_SIGNING_SECRET=<same public URL signing value>
CRON_SECRET=<independent high-entropy value>
```

Optional:

```text
NEXT_PUBLIC_SHORTCUT_URL=<published iCloud Shortcut>
NEXT_PUBLIC_CF_ANALYTICS_TOKEN=<Cloudflare Web Analytics token>
```

The Shortcut and analytics values may remain empty during preview. No content-provider billing credentials are required.

## 4. Preview acceptance

Verify:

- all routes in the sitemap return successfully;
- configurator choices persist after reload;
- the copied URL matches all three selections;
- first wallpaper request is `200 image/png`;
- repeated request becomes a `307` cache hit when the Worker is configured;
- `HEAD` has the same metadata and no body;
- all three dimensions and the 2.2 MiB ceiling hold;
- the wallpaper includes lesson and image attribution;
- provider and Worker outages still return the reviewed fallback image;
- Apple Shortcut runs once manually and through an automation.

## 5. Production promotion

After explicit preview approval, attach `wallcab.dhruvdev.me`, set `NEXT_PUBLIC_SITE_URL` to that canonical origin, redeploy, and verify Open Graph, sitemap, robots, RSS, OpenAPI, security headers, cron authentication, and signed cache URLs.

Production launch also requires the final `NEXT_PUBLIC_SHORTCUT_URL`. Until it is set, the installation page intentionally presents the complete manual guide and a disabled download state.

## Rollback

Vercel: promote the last known-good deployment. Cloudflare: redeploy the previous Worker version. A Worker rollback is optional for continuity because the Next.js renderer returns a first image even when caching fails. Never reuse or expose a compromised secret; rotate both sides and redeploy.

Docker is not a supported MVP deployment and no Dockerfile is included.
