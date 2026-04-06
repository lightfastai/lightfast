---
date: 2026-04-05T12:00:00+08:00
researcher: claude
git_commit: 49b1745f8253dd50feff86d7d7db1f8b95628480
branch: main
topic: "BetterStack env var naming mismatch between Vercel integration and @vendor/observability"
tags: [research, codebase, observability, betterstack, logtail, env-vars]
status: complete
last_updated: 2026-04-05
---

# Research: BetterStack Env Var Naming Mismatch

**Date**: 2026-04-05
**Git Commit**: 49b1745f8
**Branch**: main

## Research Question

1. What are the correct env var names that `@logtail/next` reads internally?
2. There's a naming mismatch: the Vercel BetterStack integration injects `NEXT_PUBLIC_BETTER_STACK_*` (with underscore-separated `BETTER_STACK`), but `@vendor/observability` env schemas use `BETTERSTACK_*` (no underscore). Which is correct?
3. Do we even need the non-`NEXT_PUBLIC` server-only variants, or can we just use `NEXT_PUBLIC_*` everywhere?

## Summary

**There is a naming mismatch.** The `@logtail/next` library reads `BETTER_STACK` (underscore-separated), but our `@vendor/observability` env schemas define `BETTERSTACK` (no underscore). The library never sees our env vars.

Additionally, `@logtail/next` reads its own env vars directly from `process.env` at module load time — it does not accept token/URL via constructor arguments. Our `vendor/observability/src/log/next.ts` imports `{ log as logtail } from "@logtail/next"` which means the library's own config layer handles the connection, not our env schema. Our env schema is effectively dead code for the `next.ts` logger — the library ignores it entirely.

## Detailed Findings

### What `@logtail/next` Actually Reads

The library (v0.3.1) reads env vars in `dist/platform/generic.js` with fallback chains:

**Source token** (priority order):
1. `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN`
2. `BETTER_STACK_SOURCE_TOKEN`
3. `NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN`
4. `LOGTAIL_SOURCE_TOKEN`

**Ingesting URL** (priority order):
1. `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL`
2. `BETTER_STACK_INGESTING_URL`
3. `NEXT_PUBLIC_LOGTAIL_URL`
4. `LOGTAIL_URL`

**Other env vars read:**
- `dist/config.js`: `NEXT_PUBLIC_VERCEL` / `VERCEL` (platform detection), `NETLIFY`
- `dist/platform/vercel.js`: `VERCEL_REGION`, `VERCEL_ENV`, various `NEXT_PUBLIC_VERCEL_*` metadata vars
- `dist/logger.js`: `NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL` (defaults to `'debug'`)
- `dist/shared.js`: `BETTER_STACK_NO_PRETTY_PRINT`

### What Our Env Schemas Define (Wrong Names)

`vendor/observability/src/env/betterstack.ts:9-14`:
- Server: `BETTERSTACK_SOURCE_TOKEN`, `BETTERSTACK_INGESTING_HOST`
- Client: `NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN`, `NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST`

`vendor/observability/src/env/betterstack-edge.ts:10-11`:
- Server: `BETTERSTACK_SOURCE_TOKEN`, `BETTERSTACK_INGESTING_HOST`

**The mismatch**: Our schemas use `BETTERSTACK` (one word), the library and Vercel integration use `BETTER_STACK` (two words). Also, our schemas use `INGESTING_HOST` while the library uses `INGESTING_URL`.

### Turbo.json Env Declarations (Also Wrong Names)

All three apps declare the wrong names in their `turbo.json` env lists:
- `apps/app/turbo.json:13-14,31-32`
- `apps/www/turbo.json:12-13,23-24`
- `apps/platform/turbo.json:10-11,21-22`

### How `next.ts` Logger Works

`vendor/observability/src/log/next.ts:3,6,8`:
```ts
import { log as logtail } from "@logtail/next";
const shouldUseBetterStack = betterstackEnv.VERCEL_ENV === "production";
export const log = shouldUseBetterStack ? logtail : console;
```

This imports the `@logtail/next` singleton which is already self-configured from `process.env` at import time. The `betterstackEnv` object from our env schema is only used for the `VERCEL_ENV` check — the token/URL fields in our schema are never consumed by anything.

### How `edge.ts` Logger Works

`vendor/observability/src/log/edge.ts:20-29`:
```ts
const token = betterstackEdgeEnv.BETTERSTACK_SOURCE_TOKEN;
export const log = token && betterstackEdgeEnv.VERCEL_ENV === "production"
  ? fromLogtail(new Logtail(token, { endpoint: betterstackEdgeEnv.BETTERSTACK_INGESTING_HOST }))
  : { ...console, flush: () => Promise.resolve() };
```

The edge logger **does** use our env schema to manually construct a `Logtail` instance. This is the one place the env vars are actually consumed — and it reads `BETTERSTACK_SOURCE_TOKEN` / `BETTERSTACK_INGESTING_HOST`, which won't match the Vercel-injected `BETTER_STACK_SOURCE_TOKEN` / `BETTER_STACK_INGESTING_URL`.

### Do We Need Non-NEXT_PUBLIC Server Variants?

**For `@logtail/next` (next.ts)**: No. The library already has its own fallback chain that tries `NEXT_PUBLIC_BETTER_STACK_*` first, then `BETTER_STACK_*`. It handles both contexts internally.

**For `@logtail/edge` (edge.ts)**: The edge logger manually constructs a `Logtail` instance and passes the token/endpoint explicitly. In edge runtime, `NEXT_PUBLIC_*` vars are available via `process.env` just like server vars (they're inlined at build time). So `NEXT_PUBLIC_BETTER_STACK_*` would work here too.

**Conclusion**: The `NEXT_PUBLIC_` versions are sufficient. The non-prefixed server variants are redundant because:
1. `@logtail/next` already tries `NEXT_PUBLIC_*` first in its fallback chain
2. In edge/server contexts, `NEXT_PUBLIC_*` vars are accessible via `process.env`
3. The Vercel integration only injects `NEXT_PUBLIC_*` variants

## Code References

- `vendor/observability/src/env/betterstack.ts:9-14` — Env schema with wrong names (`BETTERSTACK_*`)
- `vendor/observability/src/env/betterstack-edge.ts:10-11` — Edge env schema with wrong names
- `vendor/observability/src/log/next.ts:3-8` — Next.js logger (uses `@logtail/next` singleton)
- `vendor/observability/src/log/edge.ts:20-29` — Edge logger (manually constructs Logtail with our env vars)
- `apps/app/turbo.json:13-14,31-32` — Turbo env declarations (wrong names)
- `apps/www/turbo.json:12-13,23-24` — Same
- `apps/platform/turbo.json:10-11,21-22` — Same
- `node_modules/.pnpm/@logtail+next@0.3.1_.../dist/platform/generic.js:11-13` — Library's actual env var reading
- `node_modules/.pnpm/@logtail+next@0.3.1_.../dist/config.js:12-14` — Platform detection

## Architecture Documentation

### Current Flow (Broken)

```
Vercel Integration injects:
  NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN
  NEXT_PUBLIC_BETTER_STACK_INGESTING_URL

@logtail/next reads:        NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN  ✅ (works)
@vendor/observability reads: NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN   ❌ (never set)
                             BETTERSTACK_SOURCE_TOKEN               ❌ (never set)
```

- The `next.ts` logger works in production because `@logtail/next` reads its own env vars directly — our schema is bypassed.
- The `edge.ts` logger is broken in production because it reads `BETTERSTACK_SOURCE_TOKEN` from our schema, which doesn't match what Vercel injects.

## Open Questions

1. Should the edge logger be refactored to also use `@logtail/next` (or `@logtail/edge`'s own config), removing the manual Logtail construction, so env vars are handled consistently?
2. Is the `shouldUseBetterStack` guard in `next.ts` redundant? If the token isn't set, `@logtail/next` already falls back to console output internally.
