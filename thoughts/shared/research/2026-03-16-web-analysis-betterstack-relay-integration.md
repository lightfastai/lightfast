---
date: 2026-03-16T00:00:00+00:00
researcher: claude-sonnet-4-6
topic: "Better Stack end-to-end integration for relay — Vercel log drain + SDK setup"
tags: [research, web-analysis, betterstack, logtail, vercel, relay, logging, observability]
status: complete
created_at: 2026-03-16
confidence: high
sources_count: 6
---

# Web Research: Better Stack End-to-End Integration for Relay

**Date**: 2026-03-16
**Topic**: Better Stack (Logtail) complete setup — Vercel log drain + SDK logger for `apps/relay`
**Confidence**: High — official docs + codebase analysis

---

## Research Question

The Vercel log drain was configured through Vercel Sources but logs are not appearing in Better Stack. The internal SDK implementation in `apps/relay` was never fully set up. What is the complete end-to-end setup?

---

## Executive Summary

There are **two independent pipelines** — Vercel log drain and SDK-based logging — that send to **different Better Stack sources**. The codebase already has the SDK integration built (`@logtail/edge` via `@vendor/observability/service-log`), but it has never been activated because `LOGTAIL_SOURCE_TOKEN` is not set in the relay's Vercel environment variables.

The Vercel log drain (if configured) captures raw `stdout` from all Vercel functions. The SDK (`@logtail/edge`) captures only what you explicitly call `log.info()` etc. on — but gives structured context, service names, and correlation IDs.

**Most likely root cause for missing logs**: `LOGTAIL_SOURCE_TOKEN` is not set as a Vercel environment variable for the relay project. Additionally, `service-log.ts` does not pass the `endpoint` option to `new Logtail()`, which can cause silent failures if your Better Stack source uses a non-default ingesting host.

---

## The Two Pipelines — Key Distinction

| | Vercel Log Drain | SDK (`@logtail/edge`) |
|---|---|---|
| **What it captures** | All stdout/stderr, build output, static, edge, lambda | Only explicit `log.info()` etc. calls |
| **Better Stack source type** | HTTP source | Node.js source |
| **Auth** | `Authorization: Bearer <token>` header in Vercel drain config | `LOGTAIL_SOURCE_TOKEN` env var |
| **Vercel plan required** | Pro or Enterprise only | Any plan |
| **Structure** | Raw text / Vercel-formatted JSON | Structured JSON with service, env, ctx |
| **In this codebase** | Configured externally in Vercel dashboard | `vendor/observability/src/service-log.ts` |

These go to **separate Better Stack sources**. Copying the drain's source token into `LOGTAIL_SOURCE_TOKEN` will not fix the SDK logs — they will appear in the wrong source.

---

## Current Codebase State

### What's already built and correct

- `vendor/observability/src/service-log.ts` — `createServiceLogger` using `@logtail/edge ^0.5.8`
- `apps/relay/src/logger.ts` — relay's logger singleton
- `apps/relay/src/middleware/lifecycle.ts` — `waitUntil`-based flush (edge-safe)
- `apps/relay/src/env.ts` line 20 — `LOGTAIL_SOURCE_TOKEN` defined as optional

### What's missing / broken

**1. `LOGTAIL_SOURCE_TOKEN` not set in Vercel project env vars**

`service-log.ts` lines 27-29:
```typescript
const shouldShip =
  config.token &&
  (config.environment === "production" || config.environment === "preview");
```
If `config.token` is `undefined` (token not set), `shouldShip` is `false` and all logs silently fall back to `console`. No error is thrown. This is the most likely reason logs are not appearing.

**2. `service-log.ts` does not pass `endpoint` to Logtail constructor**

`service-log.ts` line 42:
```typescript
const logtail = new Logtail(config.token!);
```
No `endpoint` option is passed. The default endpoint is `https://in.logs.betterstack.com`. If your Better Stack source was created in a non-default region, or if Better Stack changes their ingesting host, logs will be silently dropped. This should be fixed by making the endpoint configurable.

**3. Relay `env.ts` has no `LOGTAIL_INGESTING_URL` variable**

`betterstack-env.ts` already defines `LOGTAIL_URL` for Next.js apps but the relay never wires it up. Without this, you cannot configure a custom endpoint for the relay's Logtail instance.

---

## Fix Plan

### Step 1 — Create the right Better Stack source

1. Go to **Better Stack → Logs → Sources → Connect source**
2. Select platform: **Node.js** (not HTTP — that's for the log drain)
3. Name it: `relay-production` (or `relay`)
4. Note the **Source Token** and **Ingesting URL** from the Configure tab

### Step 2 — Set env vars in Vercel

In the relay's Vercel project settings → Environment Variables, add:

```
LOGTAIL_SOURCE_TOKEN = <source-token-from-step-1>
```

Set it for **Production** and **Preview** environments. It does not need to be set for Development (the codebase intentionally falls back to console there).

### Step 3 — Pass endpoint to Logtail constructor (code fix)

In `vendor/observability/src/service-log.ts`, update `ServiceLoggerConfig` and the Logtail instantiation:

```typescript
export interface ServiceLoggerConfig {
  environment: string | undefined;
  service: string;
  token: string | undefined;
  endpoint?: string;  // add this
}

// Line 42 — update to:
const logtail = new Logtail(config.token!, {
  endpoint: config.endpoint,  // falls back to default if undefined
});
```

Then in `apps/relay/src/env.ts`, add:
```typescript
LOGTAIL_INGESTING_URL: z.string().url().optional(),
```

And in `apps/relay/src/logger.ts`, pass it through:
```typescript
export const log = createServiceLogger({
  token: env.LOGTAIL_SOURCE_TOKEN,
  service: "relay",
  environment: env.VERCEL_ENV,
  endpoint: env.LOGTAIL_INGESTING_URL,
});
```

### Step 4 — Fix Vercel log drain (if you want both pipelines)

The log drain setup requires:

1. **Better Stack → Sources → Connect source → HTTP source** (separate from the SDK source)
2. Note the **Source Token** and **Ingesting Host** (e.g. `in.logs.betterstack.com`)
3. **Vercel → Team Settings → Log Drains → Add Log Drain → Custom Log Drain**
   - Endpoint: `https://<INGESTING_HOST>` (no trailing slash, no path)
   - Enable Custom Headers: `Authorization` = `Bearer <SOURCE_TOKEN>`
   - Format: **NDJSON**
   - Select the relay project
4. Click **Test Log Drain** — a test event should appear in Better Stack Live Tail within seconds
5. If it doesn't appear: check the authorization header value is exactly `Bearer <token>` with no quotes

**Note**: Vercel log drain requires **Pro or Enterprise plan**. Hobby plan does not support it.

---

## Why `shouldShip` Blocks Development Logs

This is intentional. The `VERCEL_ENV` check prevents log shipping in local dev, avoiding:
- Polluting production Better Stack with development noise
- Accidentally shipping sensitive debug data
- Unnecessary Better Stack API calls in local dev

To test the SDK integration without deploying, you can temporarily override locally:

```bash
VERCEL_ENV=preview LOGTAIL_SOURCE_TOKEN=<your-token> pnpm dev:relay
```

Logs should appear in Better Stack Live Tail within a few seconds of a request.

---

## Package Selection Rationale

The codebase correctly uses `@logtail/edge` (not `@logtail/node`):

| Package | Runtime | Notes |
|---|---|---|
| `@logtail/edge` ✅ | V8 isolates (Vercel Edge, CF Workers) | Used by relay |
| `@logtail/node` ❌ | Node.js only | Uses `http` module — unavailable in edge |
| `@logtail/next` | Next.js | Wraps console, used by console app |

Using `@logtail/node` in an edge runtime will throw `Error: The "http" module is not available in the Edge Runtime`.

---

## Flush Pattern — Already Correct

`apps/relay/src/middleware/lifecycle.ts` already implements the correct flush pattern:

```typescript
// waitUntil is edge-safe: response is sent, flush happens in background
const safeFlush = log.flush().catch(() => undefined);
try {
  c.executionCtx.waitUntil(safeFlush);
} catch {
  await safeFlush; // fallback for Node.js runtime
}
```

Without this, logs buffered after the response is sent would be dropped. This is already working correctly.

---

## Checklist

- [ ] Create Node.js source in Better Stack (for SDK)
- [ ] Set `LOGTAIL_SOURCE_TOKEN` in Vercel project env vars (Production + Preview)
- [ ] Update `service-log.ts` to accept and pass `endpoint` option
- [ ] Add `LOGTAIL_INGESTING_URL` to relay `env.ts`
- [ ] Wire `endpoint` through relay `logger.ts`
- [ ] (Optional) Create HTTP source + configure Vercel log drain for raw stdout capture
- [ ] Verify with Live Tail: deploy to Preview and trigger a webhook

---

## Risk Assessment

### High Priority
- **Missing token**: All logs silently drop to console — no observability in production. Fix: set `LOGTAIL_SOURCE_TOKEN` in Vercel env vars.
- **No endpoint**: If Better Stack changes default ingesting host or source is in different region, SDK calls fail silently. Fix: wire through `LOGTAIL_INGESTING_URL`.

### Medium Priority
- **Log drain vs SDK confusion**: Two sources means logs are split. For operations review, you'll need to check both sources unless you use Better Stack's unified dashboards.

---

## Sources

### Official Documentation
- [Better Stack Vercel Log Drain Setup](https://betterstack.com/docs/logs/vercel/log-drain/) — BetterStack, 2025
- [Better Stack Node.js SDK](https://betterstack.com/docs/logs/javascript/) — BetterStack, 2025
- [Better Stack Cloudflare Workers / Edge SDK](https://betterstack.com/docs/logs/cloudflare-worker/) — BetterStack, 2025
- [@logtail/edge package](https://github.com/logtail/logtail-js/tree/main/packages/edge) — Logtail/BetterStack, 2024

### Codebase References
- `vendor/observability/src/service-log.ts` — SDK integration factory
- `apps/relay/src/logger.ts` — relay logger singleton
- `apps/relay/src/middleware/lifecycle.ts` — flush/waitUntil pattern
- `apps/relay/src/env.ts` — env var definitions

---

**Last Updated**: 2026-03-16
**Confidence Level**: High — based on official docs + direct codebase analysis
**Next Steps**: Set `LOGTAIL_SOURCE_TOKEN` in Vercel project, then optionally wire `endpoint` through the config chain. The SDK flush/waitUntil pattern is already correct and does not need changes.
