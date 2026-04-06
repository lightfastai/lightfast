---
date: 2026-04-06T12:00:00+08:00
researcher: claude
git_commit: ebd062cfab3fe35705cf5e276491688752040af8
branch: main
topic: "Platform Sentry DSN Testing & CLI Verification"
tags: [research, sentry, platform, testing, observability]
status: complete
last_updated: 2026-04-06
---

# Research: Platform Sentry DSN Testing & CLI Verification

**Date**: 2026-04-06
**Git Commit**: ebd062cfab3fe35705cf5e276491688752040af8
**Branch**: main

## Research Question

How to test that the newly configured Sentry DSN for `apps/platform` works correctly and verify that Sentry CLI can find issues.

## Summary

`apps/platform` has a DSN configured (`NEXT_PUBLIC_SENTRY_DSN`) in `.vercel/.env.development.local`. The SDK initializes via `instrumentation.ts` for both Node.js and edge runtimes. Error capture flows through two automatic middleware layers (tRPC and Inngest in `@vendor/observability`) — there are zero manual `captureException` calls in the platform codebase. The build-time CLI variables (`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`) are **not set** in the local dev environment, which means source map uploads won't work locally.

## Current Configuration

### Environment Variables Present

| Variable | Status | Value |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Set | `https://d0f825e5...@o4509202308464641.ingest.us.sentry.io/4511150171357184` |
| `SENTRY_APP_SLUG` | Set | `lightfast-dev` (for OAuth provider, not observability) |
| `SENTRY_CLIENT_ID` | Set | (for OAuth provider, not observability) |
| `SENTRY_CLIENT_SECRET` | Set | (for OAuth provider, not observability) |
| `SENTRY_ORG` | **Not set** | Needed for CLI / source map uploads |
| `SENTRY_PROJECT` | **Not set** | Needed for CLI / source map uploads |
| `SENTRY_AUTH_TOKEN` | **Not set** | Needed for CLI / source map uploads |

### SDK Initialization

- `apps/platform/src/instrumentation.ts` — Node.js and edge runtime init
- `tracesSampleRate`: `1.0` in development (all traces captured)
- `debug: false` — set to `true` temporarily for testing
- `beforeSend` filter: drops `TRPCError` with HTTP status < 500

### Automatic Error Capture Paths

1. **tRPC middleware** (`vendor/observability/src/trpc.ts:118-138`) — captures HTTP >= 500 errors
2. **Inngest middleware** (`vendor/observability/src/inngest.ts:148-183`) — captures non-NonRetriableError failures
3. **`onRequestError`** (`instrumentation.ts:65`) — Next.js built-in request error hook

### Build Plugin

- `withSentryConfig` wraps `next.config.ts` with shared `sentryOptions` from `@vendor/next/config`
- Tunnel route at `/monitoring` proxies Sentry events through the app

## Code References

- `apps/platform/src/instrumentation.ts` — SDK init (Node.js lines 30-47, edge lines 49-60)
- `apps/platform/next.config.ts:25` — `withSentryConfig` wrapper
- `vendor/next/src/config.ts:96-107` — shared `sentryOptions`
- `vendor/observability/src/env/sentry-env.ts` — env var schema
- `vendor/observability/src/trpc.ts:118-138` — tRPC error capture
- `vendor/observability/src/inngest.ts:148-183` — Inngest error capture
- `api/platform/src/trpc.ts:104-111` — tRPC middleware registration
- `api/platform/src/inngest/client.ts:12` — Inngest middleware registration
