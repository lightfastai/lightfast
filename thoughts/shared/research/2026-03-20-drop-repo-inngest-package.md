---
date: 2026-03-20T01:54:16Z
researcher: claude
git_commit: 1624e4222c8acdff8018084f70edc4bd24f96887
branch: feat/memory-service-consolidation
repository: lightfast
topic: "Drop @repo/inngest package — full consumer audit"
tags: [research, codebase, inngest, packages, refactor]
status: complete
last_updated: 2026-03-20
---

# Research: Drop `@repo/inngest` Package

**Date**: 2026-03-20T01:54:16Z
**Git Commit**: `1624e4222c8acdff8018084f70edc4bd24f96887`
**Branch**: `feat/memory-service-consolidation`

## Research Question

Map every file that depends on `@repo/inngest` and document exactly what each one
uses from it, so the package can be deleted and consumers wired directly.

---

## Package Structure

**Location**: `packages/inngest/`
**Package name**: `@repo/inngest`

### Exports

```
.          → src/index.ts    (re-exports NonRetriableError, RetryAfterError, allEvents, consoleEvents, memoryEvents)
./client   → src/client.ts   (createInngestClient factory, GetEvents type)
```

### Files

| File | What it does |
|---|---|
| `src/index.ts` | Re-exports `NonRetriableError`, `RetryAfterError` from `@vendor/inngest`. Assembles `allEvents = { ...consoleEvents, ...memoryEvents }`. |
| `src/client.ts` | `createInngestClient(options)` factory — wires `allEvents` into `EventSchemas`, conditionally adds Sentry middleware, returns a typed `Inngest` instance. Also re-exports `GetEvents` from `inngest`. |
| `src/schemas/console.ts` | `consoleEvents` — single event: `console/activity.record` (zod schema). |
| `src/schemas/memory.ts` | `memoryEvents` — 8 events covering backfill, health check, connection lifecycle, webhook ingestion, and the neural pipeline (event capture → entity upsert → entity graphed). Imports zod schemas from `@repo/app-providers` and `@repo/app-validation`. |

### Dependencies declared in `packages/inngest/package.json`

- `@inngest/middleware-sentry` (catalog)
- `@repo/app-providers` (workspace:*)
- `@repo/app-validation` (workspace:*)
- `@vendor/inngest` (workspace:*)
- `inngest` (catalog)
- `zod` (catalog)

---

## Consumer Audit — 3 packages depend on `@repo/inngest`

### 1. `api/app` (`api/app/package.json:53`)

**Only file that imports from it:**

`api/app/src/inngest/client/client.ts`

```ts
import type { GetEvents }      from "@repo/inngest/client";
import { createInngestClient } from "@repo/inngest/client";
import { env }                 from "@vendor/inngest/env";

const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  withSentry: true,           // ← Sentry middleware enabled
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

**What it needs from `@repo/inngest`:**
- `createInngestClient` factory (builds Inngest instance with all schemas + Sentry)
- `GetEvents` type (derived from the returned client)

### 2. `api/platform` (`api/platform/package.json:40`)

**Files that import from it:**

#### `api/platform/src/inngest/client.ts`

```ts
import type { GetEvents }      from "@repo/inngest/client";
import { createInngestClient } from "@repo/inngest/client";

const inngest = createInngestClient({ appName: "lightfast-memory" });
// No Sentry, no eventKey

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

#### 5 platform Inngest function files — all import the same single symbol:

| File | Import |
|---|---|
| `api/platform/src/inngest/functions/ingest-delivery.ts:25` | `import { NonRetriableError } from "@repo/inngest"` |
| `api/platform/src/inngest/functions/memory-event-store.ts:39` | `import { NonRetriableError } from "@repo/inngest"` |
| `api/platform/src/inngest/functions/memory-entity-embed.ts:21` | `import { NonRetriableError } from "@repo/inngest"` |
| `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:27` | `import { NonRetriableError } from "@repo/inngest"` |
| `api/platform/src/inngest/functions/memory-entity-worker.ts:20` | `import { NonRetriableError } from "@repo/inngest"` |

**What `api/platform` needs from `@repo/inngest`:**
- `createInngestClient` factory (from `./client`)
- `GetEvents` type (from `./client`)
- `NonRetriableError` re-export (from `.`) — currently a pass-through from `@vendor/inngest`

### 3. `apps/platform` (`apps/platform/package.json:19`)

**Not a source import.** Referenced only in `apps/platform/next.config.ts`:

```ts
// serverExternalPackages — line 14
"@repo/inngest",

// experimental.optimizePackageImports — line 24
"@repo/inngest",
```

Both are Next.js bundler configuration entries. No TypeScript source in `apps/platform` imports from `@repo/inngest` directly.

---

## What `@vendor/inngest` Already Exports

`vendor/inngest/src/index.ts` already re-exports:

```ts
export { EventSchemas, Inngest, InngestMiddleware, NonRetriableError, RetryAfterError } from "inngest";
```

`NonRetriableError` and `RetryAfterError` are available directly from `@vendor/inngest`.

---

## Migration Surface — Complete Change List

### Event schemas
The two schema files (`consoleEvents`, `memoryEvents`) need to move into or be inlined within the consuming `api/*` layers. `memoryEvents` depends on `@repo/app-providers` and `@repo/app-validation`.

### Symbol-by-symbol replacement

| Current import | Replacement |
|---|---|
| `NonRetriableError` from `@repo/inngest` | `NonRetriableError` from `@vendor/inngest` |
| `RetryAfterError` from `@repo/inngest` | `RetryAfterError` from `@vendor/inngest` |
| `createInngestClient` from `@repo/inngest/client` | Inline: `new Inngest({ id, eventKey, schemas, middleware })` |
| `GetEvents` from `@repo/inngest/client` | `GetEvents` from `inngest` (direct) |
| `allEvents` / `consoleEvents` / `memoryEvents` from `@repo/inngest` | Move schema files into `api/app` or `api/platform` as needed |

### Files to touch

| File | Change needed |
|---|---|
| `api/app/src/inngest/client/client.ts` | Inline client construction; move/import schemas locally |
| `api/platform/src/inngest/client.ts` | Inline client construction; move/import schemas locally |
| `api/platform/src/inngest/functions/ingest-delivery.ts` | `@repo/inngest` → `@vendor/inngest` |
| `api/platform/src/inngest/functions/memory-event-store.ts` | `@repo/inngest` → `@vendor/inngest` |
| `api/platform/src/inngest/functions/memory-entity-embed.ts` | `@repo/inngest` → `@vendor/inngest` |
| `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts` | `@repo/inngest` → `@vendor/inngest` |
| `api/platform/src/inngest/functions/memory-entity-worker.ts` | `@repo/inngest` → `@vendor/inngest` |
| `apps/platform/next.config.ts` | Remove `@repo/inngest` from `serverExternalPackages` and `optimizePackageImports` |
| `api/app/package.json` | Remove `"@repo/inngest": "workspace:*"` |
| `api/platform/package.json` | Remove `"@repo/inngest": "workspace:*"` |
| `apps/platform/package.json` | Remove `"@repo/inngest": "workspace:*"` |
| `packages/inngest/` | Delete entire directory |

### Schema file destinations

| Schema | Current location | Candidate destination |
|---|---|---|
| `consoleEvents` | `packages/inngest/src/schemas/console.ts` | `api/app/src/inngest/schemas/console.ts` |
| `memoryEvents` | `packages/inngest/src/schemas/memory.ts` | `api/platform/src/inngest/schemas/memory.ts` |

Cross-service note: both clients currently register `allEvents` (both schema sets combined). If cross-service event sending requires the other service's types, each `api/*` layer will need to either import from the other's package or duplicate/share the schemas via a lighter-weight path (e.g., `@repo/app-providers` already holds some of the underlying zod schemas).

---

## Code References

- `packages/inngest/src/index.ts:1-12` — Package root export
- `packages/inngest/src/client.ts:1-43` — `createInngestClient` factory
- `packages/inngest/src/schemas/console.ts:3-25` — `consoleEvents` (1 event)
- `packages/inngest/src/schemas/memory.ts:7-104` — `memoryEvents` (8 events)
- `api/app/src/inngest/client/client.ts:1-16` — `api/app` client using factory
- `api/platform/src/inngest/client.ts:1-15` — `api/platform` client using factory
- `api/platform/src/inngest/functions/ingest-delivery.ts:25` — `NonRetriableError` import
- `api/platform/src/inngest/functions/memory-event-store.ts:39` — `NonRetriableError` import
- `api/platform/src/inngest/functions/memory-entity-embed.ts:21` — `NonRetriableError` import
- `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:27` — `NonRetriableError` import
- `api/platform/src/inngest/functions/memory-entity-worker.ts:20` — `NonRetriableError` import
- `apps/platform/next.config.ts:14,24` — bundler config entries (no source imports)
- `vendor/inngest/src/index.ts:1-7` — `@vendor/inngest` already exports `NonRetriableError`
