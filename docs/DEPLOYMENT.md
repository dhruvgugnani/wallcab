# Deployment runbook

WallCab uses Cloudflare Workers KV for the active-day image cache and private optional user backgrounds, Analytics Engine for anonymous automation-run counters, and Vercel for the website, provider pipeline, renderer, and scheduled rollover. The Worker should be deployed first so a Vercel preview can exercise cache, upload, and analytics paths.

Creating external resources changes account state. Run these commands only in the intended Cloudflare and Vercel accounts.

## 1. Verify locally

```powershell
npm.cmd ci
npm.cmd run audit
npm.cmd run check
npm.cmd run test:e2e
```

The installed Node version must be 24.x. Do not deploy when the lockfile audit, Worker type check, image ceiling, build, or browser tests fail.

## 2. Create Workers KV and usage analytics

Confirm the active Cloudflare identity:

```powershell
npx.cmd wrangler whoami
```

Create the namespace:

```powershell
npx.cmd wrangler kv namespace create WALLPAPERS
```

Copy the exact opaque namespace ID into `worker/wrangler.jsonc`. Do not derive or reformat it.

The same private namespace stores active-day cache records, normalized custom
backgrounds, and their lifecycle metadata. It is reachable only through the
Worker's authenticated routes; there is no public raw-image URL. No R2
subscription, R2 bucket, database, or storage API key is required.

The Workers Free plan has hard KV allowances, including 1 GB stored data,
100,000 reads per day, and 1,000 writes per day. Operations fail after a free
limit is reached instead of creating usage charges. Current limits are listed
in the [Workers KV pricing documentation](https://developers.cloudflare.com/kv/platform/pricing/).
The Worker schedules a cleanup at 03:17 UTC and removes uploads after 30 days
without a wallpaper read.

The wallcab_usage Analytics Engine binding is declared in the Worker
configuration and is created automatically on its first accepted write. It
records only standalone operational run events. The public Worker has no
analytics read token, and the separate private reporting deployment is the
only place that receives Account Analytics Read access. Cloudflare currently
includes 100,000 writes and 10,000 read queries per day on Workers Free and
retains Analytics Engine events for three months. See the current
[Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)
and [retention limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/).

Before the first deployment with this binding, open Workers & Pages,
Analytics Engine in the Cloudflare dashboard and select Enable. Without this
one-time account toggle, Wrangler stops with error code 10089. Cloudflare's
current pricing page states that Analytics Engine usage is not presently
billed; review that page again if Cloudflare changes its announced policy.

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

## 3. Create Turnstile

Create one managed Turnstile widget in the Cloudflare dashboard:

- allowed hostnames: `wallcab.vercel.app` and `wallcab.dhruvdev.me`;
- protected action: the homepage custom-background upload;
- client action value: `custom_background_upload`.

Save the public site key and secret separately. The site key is safe for the
browser; the secret is server-only. WallCab verifies the token, exact action,
and exact hostname before reading and normalizing an upload. Tokens are
single-use, so the configurator resets the widget after every attempt.

For localhost only, Cloudflare's documented always-pass test site key and
secret may be placed in `.env.local`. Never use test keys in Vercel.

## 4. Create the Vercel preview

Confirm the active identity:

```powershell
npx.cmd vercel whoami
```

Link only this repository directory, not its parent workspace. Configure:

```text
NEXT_PUBLIC_SITE_URL=https://wallcab.dhruvdev.me
CACHE_WORKER_URL=<exact Worker origin>
CACHE_WORKER_SECRET=<same private HMAC value>
CACHE_SIGNING_SECRET=<same public URL signing value>
CRON_SECRET=<independent high-entropy value>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Turnstile public site key>
TURNSTILE_SECRET=<Turnstile server secret>
TURNSTILE_HOSTNAMES=wallcab.vercel.app,wallcab.dhruvdev.me
NEXT_PUBLIC_SHORTCUT_URL=https://www.icloud.com/shortcuts/1ca82c739d3f44ffb448ca2f44b4869b
```

Optional:

```text
NEXT_PUBLIC_CF_ANALYTICS_TOKEN=<Cloudflare Web Analytics token>
```

Analytics may remain empty. No content-provider billing credentials are
required. Do not upload `.env.local` to Vercel; add each value to the project
environment settings so secrets do not enter Git or a deployment archive.

## 5. Preview acceptance

Verify:

- all routes in the sitemap return successfully;
- configurator choices persist after reload;
- the copied URL matches all three selections;
- a custom image is resized, uploaded after Turnstile succeeds, and appears
  behind the daily lesson;
- switching back to a built-in theme preserves the private deletion link;
- the deletion link works only after confirmation and the old custom URL then
  falls back safely;
- first wallpaper request is `200 image/png`;
- repeated request becomes a `307` cache hit when the Worker is configured;
- a request with `note=Property%20of%20Dhruv` returns
  `X-WallCab-Cache: BYPASS` and is not uploaded as a shared final image;
- `HEAD` has the same metadata and no body;
- all three dimensions and the 2.2 MiB ceiling hold;
- the wallpaper includes lesson and image attribution;
- provider and Worker outages still return the reviewed fallback image;
- valid wallpaper GET requests write one anonymous run event while previews,
  HEAD, status, invalid, rate-limited, cron, and internal requests write none;
- Apple Shortcut runs once manually and through an automation.

## 6. Production promotion

After explicit preview approval, attach `wallcab.dhruvdev.me`, keep
`NEXT_PUBLIC_SITE_URL` set to that canonical origin, redeploy, and verify Open
Graph, sitemap, robots, RSS, OpenAPI, security headers, cron authentication,
and signed cache URLs.

The published Shortcut currently points to
`https://www.icloud.com/shortcuts/1ca82c739d3f44ffb448ca2f44b4869b`.
The installation page also keeps the complete manual guide available if Apple
changes a label or a user prefers to inspect every action.

## Rollback

Vercel: promote the last known-good deployment. Cloudflare: redeploy the previous Worker version. A Worker rollback is optional for continuity because the Next.js renderer returns a first image even when caching fails. Never reuse or expose a compromised secret; rotate both sides and redeploy.

Docker is not a supported MVP deployment and no Dockerfile is included.
