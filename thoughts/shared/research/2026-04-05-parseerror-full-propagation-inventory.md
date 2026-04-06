---
date: 2026-04-05T23:30:00+08:00
researcher: claude
git_commit: d3f2a3fb9cba48b5232e837addfc52c3a8df26e2
branch: main
topic: "parseError full propagation inventory — every layer from api to apps"
tags: [research, codebase, observability, parseError, error-handling, propagation]
status: complete
last_updated: 2026-04-05
---

# Research: `parseError` Full Propagation Inventory

**Date**: 2026-04-05T23:30:00+08:00
**Git Commit**: d3f2a3fb9cba48b5232e837addfc52c3a8df26e2
**Branch**: main

## Research Question

Deep investigation of every layer from api to apps that still needs `parseError` integration. The previous inventory (items 1-6) documented 45 manual sites across 25 files. Fixes have since been applied. This research documents the current state: where `parseError` is now used, and where manual patterns remain.

## Summary

The `parseError` utility at `vendor/observability/src/error/next.ts` is now imported and used in **26 files** across **58 call sites** — up from 0 at the time of the original inventory. The `server-only` guard was removed, making it importable from any context including client components. However, **12 files across 4 layers** still contain manual error extraction patterns that could use `parseError`. These break down into: 6 sites in `api/platform` (Inngest functions, OAuth callback, token helpers, connections router), 2 sites in `apps/app` (API route), 2 sites in `vendor/` (pinecone, embed), 1 site in `packages/ui` (prompt-input), and 2 sites in `packages/app-rerank` that pass raw `error` objects to `log` without string extraction.

---

## Current State of `parseError`

### The Utility

[`vendor/observability/src/error/next.ts:1-12`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/vendor/observability/src/error/next.ts)

```ts
export const parseError = (error: unknown): string => {
  if (error instanceof Error) { return error.message; }
  if (error && typeof error === "object" && "message" in error) {
    return error.message as string;
  }
  if (typeof error === "string") { return error; }
  return String(error);
};
```

- **No `server-only` guard** — usable in both server and client contexts
- **Export path**: `@vendor/observability/error/next`
- **Only file** in `vendor/observability/src/error/` directory
- Four-branch resolution vs two-branch manual ternary

### Server-Only Boundary Within `@vendor/observability`

| Export path | `server-only`? |
|---|---|
| `@vendor/observability/error/next` | **No** |
| `@vendor/observability/log/next` | Yes |
| `@vendor/observability/context` | Yes |
| `@vendor/observability/request` | Yes |
| `@vendor/observability/trpc` | Yes |

---

## Adoption: 26 Files, 58 Call Sites

### `api/app/` (5 files, 12 call sites)

| File | Import Line | Call Lines |
|---|---|---|
| [`api/app/src/lib/activity.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/app/src/lib/activity.ts) | 34 | 163, 168, 259, 264, 342, 381, 387 |
| [`api/app/src/router/org/connections.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/app/src/router/org/connections.ts) | 15 | 250, 419 |
| [`api/app/src/router/user/organization.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/app/src/router/user/organization.ts) | 5 | 93, 184 |
| [`api/app/src/router/user/account.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/app/src/router/user/account.ts) | 4 | 50 |
| [`api/app/src/inngest/workflow/infrastructure/record-activity.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/app/src/inngest/workflow/infrastructure/record-activity.ts) | 18 | 116 |

### `api/platform/` (8 files, 17 call sites)

| File | Import Line | Call Lines |
|---|---|---|
| [`api/platform/src/router/platform/backfill.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/platform/src/router/platform/backfill.ts) | 29 | 98, 150, 247, 280, 400 |
| [`api/platform/src/router/platform/proxy.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/platform/src/router/platform/proxy.ts) | 17 | 161, 221, 250 |
| [`api/platform/src/inngest/functions/connection-lifecycle.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/platform/src/inngest/functions/connection-lifecycle.ts) | 25 | 92, 160 |
| [`api/platform/src/inngest/functions/platform-backfill-orchestrator.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/platform/src/inngest/functions/platform-backfill-orchestrator.ts) | 25 | 206, 317 |
| [`api/platform/src/inngest/functions/platform-entity-worker.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/platform/src/inngest/functions/platform-entity-worker.ts) | 22 | 148 |
| [`api/platform/src/inngest/functions/token-refresh.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/platform/src/inngest/functions/token-refresh.ts) | 17 | 124 |
| [`api/platform/src/lib/token-store.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/platform/src/lib/token-store.ts) | 6 | 74 |
| [`api/platform/src/trpc.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/api/platform/src/trpc.ts) | 8 | 64 |

### `apps/app/` (9 files, 10 call sites)

| File | Import Line | Call Lines |
|---|---|---|
| [`apps/app/src/lib/proxy.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/lib/proxy.ts) | 10 | 92 |
| [`apps/app/src/app/(api)/lib/with-api-key-auth.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/app/(api)/lib/with-api-key-auth.ts) | 11 | 144 |
| [`apps/app/src/app/(api)/lib/orpc-router.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/app/(api)/lib/orpc-router.ts) | 3 | 66 |
| [`apps/app/src/app/(api)/v1/[...rest]/route.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/app/(api)/v1/[...rest]/route.ts) | 3 | 37 |
| [`apps/app/src/app/(api)/v1/answer/[...v]/route.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/app/(api)/v1/answer/[...v]/route.ts) | 8 | 118, 209 |
| [`apps/app/src/app/(app)/(org)/[slug]/layout.tsx`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/app/(app)/(org)/[slug]/layout.tsx) | 3 | 61 |
| [`apps/app/src/app/(early-access)/_actions/early-access.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/app/(early-access)/_actions/early-access.ts) | 6 | 302 |
| [`apps/app/src/app/api/gateway/stream/route.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/app/api/gateway/stream/route.ts) | 5 | 112 |
| [`apps/app/src/components/org-search.tsx`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/app/src/components/org-search.tsx) | 9 | 144 (client component) |

### `apps/platform/` (1 file, 1 call site)

| File | Import Line | Call Lines |
|---|---|---|
| [`apps/platform/src/app/api/ingest/[provider]/route.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/apps/platform/src/app/api/ingest/[provider]/route.ts) | 21 | 154 |

### `packages/` (5 files, 7 call sites)

| File | Import Line | Call Lines |
|---|---|---|
| [`packages/app-clerk-cache/src/membership.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/packages/app-clerk-cache/src/membership.ts) | 2 | 45, 56 |
| [`packages/app-config/src/parse.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/packages/app-config/src/parse.ts) | 9 | 90 |
| [`packages/app-config/src/glob.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/packages/app-config/src/glob.ts) | 7 | 60 |
| [`packages/app-test-data/src/raw.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/packages/app-test-data/src/raw.ts) | 12 | 68 |
| [`packages/app-test-data/src/cli/verify-datasets.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/packages/app-test-data/src/cli/verify-datasets.ts) | 21 | 45 |

### `vendor/` (2 files, 2 call sites)

| File | Import Line | Call Lines |
|---|---|---|
| [`vendor/mcp/src/index.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/vendor/mcp/src/index.ts) | 3 | 85 |
| [`vendor/pinecone/src/client.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/vendor/pinecone/src/client.ts) | 9 | 333 |

### `core/` (1 file, 4 call sites)

| File | Import Line | Call Lines |
|---|---|---|
| [`core/ai-sdk/src/core/primitives/agent.ts`](https://github.com/lightfastai/lightfast/blob/d3f2a3fb9cba48b5232e837addfc52c3a8df26e2/core/ai-sdk/src/core/primitives/agent.ts) | 1 | 191, 234, 270, 289 |

---

## Remaining Manual Patterns: 12 Files, ~15 Sites

### Layer 1: `api/platform/` — 4 files, 6 sites

#### `api/platform/src/inngest/functions/health-check.ts` — lines 97, 120

Two `catch (err)` blocks using `err instanceof Error ? err.message : String(err)` inside `log.warn` calls. These are in the token fetch step (line 97) and provider health probe step (line 120).

```ts
// Line 97 (inside catch):
log.warn("[health-check] token fetch failed", {
  error: err instanceof Error ? err.message : String(err),
});
```

#### `api/platform/src/inngest/functions/delivery-recovery.ts` — lines 89, 149

Two `catch (err)` blocks using the same manual ternary inside `log.warn` calls. Line 89 is around `providerDef.webhook.extractResourceId`; line 149 is the outer per-delivery catch in the replay loop.

#### `api/platform/src/lib/oauth/callback.ts` — line 351

Top-level OAuth callback catch using `err instanceof Error ? err.message : "unknown"` (sentinel fallback instead of `String(err)`). The extracted string is passed to both `log.error` and `storeOAuthResult`.

#### `api/platform/src/lib/token-helpers.ts` — lines 118-121, 142-145

Two catch blocks using `refreshErr instanceof Error ? refreshErr.message : String(refreshErr)` and `fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)` inside `log.warn` calls during token refresh and active-token fallback paths.

#### `api/platform/src/router/platform/connections.ts` — line 123

Token retrieval catch using `err instanceof Error ? err.message : "unknown"`. The extracted `message` is used in a `log.warn` call and also branched against to detect the `"no_token_found"` sentinel string.

### Layer 2: `apps/app/` — 1 file, 3 sites

#### `apps/app/src/app/(api)/v1/answer/[...v]/route.ts`

- **Line 55**: `String(err)` bare — no `instanceof` guard, inside `catch (err)` around `request.json()` parse. Passed to `log.warn`.
- **Lines 109, 200**: `error.message || JSON.stringify(error)` — inside `onError` callbacks of `fetchRequestHandler`. `error` is typed from the SDK, accessed as `error.message || JSON.stringify(error)`.

### Layer 3: `vendor/` — 2 files, 2 sites

#### `vendor/pinecone/src/client.ts` — line 88

`String(error)` bare in `console.warn` for `indexExists` failure. Notably, `parseError` is already imported in this same file (line 9) and used at line 333 in `handleError`. This is a missed site in an already-converted file.

#### `vendor/embed/src/provider/cohere.ts` — lines 145-152

Manual `instanceof Error` guard with `error.message` access for re-throw wrapping. `@vendor/embed` has no `@vendor/observability` dependency — would need to add it.

### Layer 4: `packages/` — 3 files, 3 sites

#### `packages/ui/src/components/ai-elements/prompt-input.tsx` — lines 496-501

Client component file upload catch: `error instanceof Error ? error.message : "Failed to upload attachment."`. `@repo/ui` has no `@vendor/observability` dependency. Since `parseError` is now client-safe, this could use it.

#### `packages/app-rerank/src/providers/llm.ts` — line 230

Raw `error` object passed directly to `log.error` field without `parseError()`. Already depends on `@vendor/observability`.

#### `packages/app-rerank/src/providers/cohere.ts` — line 172

Same pattern as `llm.ts` — raw `error` object passed to `log.error` without string extraction.

### Layer 5: Intentional Exclusions (not candidates for `parseError`)

These sites use `instanceof Error` for purposes beyond simple string extraction and should NOT be converted:

| File | Reason |
|---|---|
| `packages/lib/src/encryption.ts:143-228` | Domain error re-wrapping chain (`EncryptionError`/`DecryptionError`). Needs `instanceof` for type dispatch, not just message extraction. |
| `core/ai-sdk/src/core/server/errors.ts:562-700` | Typed `ApiError` converter functions (`toApiError`, `toMemoryApiError`, `toAgentApiError`). Produces typed error class instances, not strings. |
| `core/ai-sdk/src/core/server/runtime.ts:300,613` | Error identity checks and `instanceof ApiError` guards for control flow. |
| `core/ai-sdk/src/core/primitives/agent.ts:192,235,271,290` | `error instanceof Error ? error : undefined` for `cause` parameter — already uses `parseError(error)` for the message part. The `instanceof` check here preserves the original `Error` for stack trace chaining, which is a different purpose. |
| `packages/app-trpc/src/react.tsx:86` | `instanceof Error` as boolean predicate for tRPC `loggerLink` — not extracting a message. |
| `packages/platform-trpc/src/react.tsx:64` | Same — `instanceof Error` as logger predicate. |
| `packages/app-config/src/parse.ts:57-80` | Structural `"code" in error` check for `ENOENT` — different from message extraction. |
| `apps/app/src/app/lib/clerk/error-handling.ts` | Clerk-specific `getErrorMessage` with `isClerkAPIResponseError` branch — domain-specific, not general error parsing. |
| `api/platform/src/inngest/on-failure-handler.ts:73,87` | `error.message` direct access — `error` is typed as `Error` in function signature, not `unknown`. |
| `vendor/aeo/collect.ts:132` | `.catch(() => [])` — intentional silent discard of failed page collection providers. |

---

## Dependency Map: Who Can Import `parseError`

| Package | Already depends on `@vendor/observability`? | Can import `parseError`? |
|---|---|---|
| `api/app` | Yes | Yes |
| `api/platform` | Yes | Yes |
| `apps/app` | Yes | Yes (server + client) |
| `apps/platform` | Yes | Yes |
| `packages/app-clerk-cache` | Yes | Yes |
| `packages/app-config` | Yes | Yes |
| `packages/app-test-data` | Yes | Yes |
| `packages/app-rerank` | Yes | Yes |
| `vendor/mcp` | Yes | Yes |
| `vendor/pinecone` | Yes | Yes |
| `packages/ui` | **No** | Needs dependency added |
| `vendor/embed` | **No** | Needs dependency added |
| `packages/lib` | **No** | N/A (uses domain errors, not string extraction) |

---

## Code References

### parseError definition
- `vendor/observability/src/error/next.ts:1-12` — the utility
- `vendor/observability/package.json:36-39` — export path

### Remaining manual sites (candidates for conversion)
- `api/platform/src/inngest/functions/health-check.ts:97,120` — manual ternary in log.warn
- `api/platform/src/inngest/functions/delivery-recovery.ts:89,149` — manual ternary in log.warn
- `api/platform/src/lib/oauth/callback.ts:351` — manual ternary with "unknown" fallback
- `api/platform/src/lib/token-helpers.ts:118-121,142-145` — manual ternary in log.warn
- `api/platform/src/router/platform/connections.ts:123` — manual ternary with "unknown" fallback
- `apps/app/src/app/(api)/v1/answer/[...v]/route.ts:55,109,200` — String(err) and .message||JSON.stringify
- `vendor/pinecone/src/client.ts:88` — String(error) in console.warn (parseError already imported)
- `vendor/embed/src/provider/cohere.ts:145-152` — instanceof Error + .message re-throw
- `packages/ui/src/components/ai-elements/prompt-input.tsx:496-501` — manual ternary
- `packages/app-rerank/src/providers/llm.ts:230` — raw error object to log
- `packages/app-rerank/src/providers/cohere.ts:172` — raw error object to log

### Intentional exclusions (not candidates)
- `packages/lib/src/encryption.ts:143-228` — domain error type dispatch
- `core/ai-sdk/src/core/server/errors.ts:562-700` — typed error converters
- `core/ai-sdk/src/core/primitives/agent.ts:192,235,271,290` — cause parameter (already uses parseError for message)
- `api/platform/src/inngest/on-failure-handler.ts:73,87` — typed Error parameter
- `apps/app/src/app/lib/clerk/error-handling.ts` — Clerk-specific error handling

## Related Research

- [`thoughts/shared/research/2026-04-05-observability-remaining-work-inventory.md`](thoughts/shared/research/2026-04-05-observability-remaining-work-inventory.md) — Original 6-item inventory (45 sites, 25 files — now largely adopted)
- [`thoughts/shared/research/2026-04-05-observability-architecture-complete-state.md`](thoughts/shared/research/2026-04-05-observability-architecture-complete-state.md) — Full observability architecture

## Open Questions

1. **Should `packages/ui` add `@vendor/observability` as a dependency?** The `prompt-input.tsx` manual ternary (line 496-501) is the only site. Adding a dependency from `@repo/ui` to `@vendor/observability` creates a coupling between the general-purpose UI library and the observability vendor abstraction. Alternative: keep the one-liner manual pattern for the UI package.

2. **Should `vendor/embed` add `@vendor/observability` as a dependency?** The `cohere.ts` re-throw pattern (lines 145-152) is the only error handling in the package. The pattern there wraps the message into a new Error — `parseError` would simplify the message extraction but the re-throw wrapping would remain.

3. **Should `packages/app-rerank` pass `parseError(error)` to the `error` log field instead of the raw object?** The raw `error` object is currently passed directly as a structured log field. BetterStack/Logtail may serialize this differently than a plain string. Using `parseError(error)` would standardize the field to a string, matching the pattern in all other log sites. However, passing the raw object preserves the full error structure (stack trace, nested properties) in the log output.
