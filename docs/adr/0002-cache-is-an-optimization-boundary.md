# ADR 0002: Treat the Worker cache as an optimization boundary

- Status: accepted
- Date: 2026-07-25

## Context

Full-resolution wallpaper rendering is computationally expensive, but making the public API depend on a separate cache would add a second availability requirement.

## Decision

Cloudflare Worker/KV stores only the active day. Public asset reads use short-lived signatures; private reads and writes use timestamped HMAC authentication. A cache hit redirects temporarily to the Worker.

On a miss, Vercel generates and returns the image first, then uploads it after the response. Cache lookup, upload, or Worker failure never prevents direct rendering.

## Consequences

The initial request may be slower, but the user still receives an image during a cache outage. The renderer version is part of every key. KV may be disabled entirely for local development or a minimal self-hosted deployment.
