---
date: 2026-04-05T12:00:00+08:00
researcher: claude
git_commit: c61301f8c36f8bacf121ce06e6b8c9e7c87c4ed0
branch: main
topic: "Audit of 'console' naming in @api/app and 'memory' naming in @api/platform"
tags: [research, codebase, naming, api-app, api-platform, inngest, trpc]
status: complete
last_updated: 2026-04-05
---

# Research: Console & Memory Naming Audit

**Date**: 2026-04-05
**Git Commit**: c61301f8c
**Branch**: main

## Research Question

Audit all instances where "console" appears as product/service naming in `@api/app/` (should be "app") and where "memory" appears as product/service naming in `@api/platform/` (should be "platform"). Include cross-package references.

## Summary

**`@api/app/`** has a contained "console" footprint: 1 schema file named `console.ts`, 1 exported const `consoleEvents`, 1 Inngest function ID prefix `console/`, and 1 event name prefix `console/`. Total: ~11 occurrences across 4 files.

**`@api/platform/`** has a pervasive "memory" footprint: 1 directory, 10 files named with "memory", 5 exported types, 8+ exported functions/consts, 11 Inngest function IDs, 10 Inngest event name schemas (~30 reference sites), 2 JWT audience strings, and ~35 comments. Total: ~100+ occurrences across every layer.

**Cross-package**: The naming leaks into `packages/platform-trpc` (bridge layer), `packages/app-pinecone`, `packages/app-api-key`, `packages/app-clerk-m2m`, `core/ai-sdk`, `apps/app`, `apps/www`, and `apps/platform`.

---

## Part 1: "console" in `@api/app/`

### Files

| File | Type |
|---|---|
| `api/app/src/inngest/schemas/console.ts` | Schema file named "console" |

### Identifiers

| File | Line | Identifier | Kind |
|---|---|---|---|
| `src/inngest/schemas/console.ts` | 3 | `consoleEvents` | Exported const |
| `src/inngest/client/client.ts` | 6 | `import { consoleEvents } from "../schemas/console"` | Import path + identifier |
| `src/inngest/client/client.ts` | 11 | `consoleEvents` | Reference |

### Inngest Event Names

| File | Line | String |
|---|---|---|
| `src/inngest/schemas/console.ts` | 4 | `"console/activity.record"` |
| `src/inngest/workflow/infrastructure/record-activity.ts` | 46 | `"console/activity.record"` (trigger) |
| `src/lib/activity.ts` | 233 | `"console/activity.record"` (send) |
| `src/lib/activity.ts` | 323 | `"console/activity.record"` (send) |

### Inngest Function IDs

| File | Line | String |
|---|---|---|
| `src/inngest/workflow/infrastructure/record-activity.ts` | 29 | `"console/record-activity"` |

### Comments

| File | Line | Text |
|---|---|---|
| `src/inngest/index.ts` | 2 | `"Inngest exports for console application"` |
| `src/inngest/workflow/infrastructure/record-activity.ts` | 8 | `"console/activity.record events"` |

---

## Part 2: "memory" in `@api/platform/`

### Directories & Files

| Path | Kind |
|---|---|
| `src/router/memory/` | Directory |
| `src/router/memory/backfill.ts` | Router file |
| `src/router/memory/connections.ts` | Router file |
| `src/router/memory/proxy.ts` | Router file |
| `src/inngest/functions/memory-backfill-orchestrator.ts` | Inngest function |
| `src/inngest/functions/memory-entity-embed.ts` | Inngest function |
| `src/inngest/functions/memory-entity-graph.ts` | Inngest function |
| `src/inngest/functions/memory-entity-worker.ts` | Inngest function |
| `src/inngest/functions/memory-event-store.ts` | Inngest function |
| `src/inngest/functions/memory-notification-dispatch.ts` | Inngest function |
| `src/inngest/schemas/memory.ts` | Schema file |

### Exported Types

| File | Line | Type |
|---|---|---|
| `src/index.ts` | 10 | `MemoryRouter` |
| `src/index.ts` | 12 | `MemoryAuthContext` |
| `src/index.ts` | 17 | `MemoryRouterInputs` |
| `src/index.ts` | 18 | `MemoryRouterOutputs` |
| `src/root.ts` | 43 | `MemoryRouter` (source definition) |
| `src/trpc.ts` | 23 | `MemoryAuthContext` (source definition) |

### Exported Functions/Consts

| File | Line | Name |
|---|---|---|
| `src/index.ts` | 11 | `memoryRouter` |
| `src/index.ts` | 14 | `createMemoryTRPCContext` |
| `src/root.ts` | 24 | `memoryRouter` (source definition) |
| `src/trpc.ts` | 40 | `createMemoryTRPCContext` (source definition) |
| `src/inngest/schemas/memory.ts` | 9 | `memoryEvents` |
| `src/inngest/functions/` | various | `memoryBackfillOrchestrator`, `memoryEntityEmbed`, `memoryEntityGraph`, `memoryEntityWorker`, `memoryEventStore`, `memoryNotificationDispatch` |

### Inngest Function IDs (11 total)

| File | Line | ID |
|---|---|---|
| `memory-backfill-orchestrator.ts` | 33 | `"memory/backfill.orchestrator"` |
| `memory-entity-embed.ts` | 52 | `"memory/entity.embed"` |
| `memory-entity-graph.ts` | 19 | `"memory/entity.graph"` |
| `memory-entity-worker.ts` | 33 | `"memory/backfill.entity-worker"` |
| `memory-event-store.ts` | 78 | `"memory/event.store"` |
| `memory-notification-dispatch.ts` | 9 | `"memory/notification.dispatch"` |
| `health-check.ts` | 28 | `"memory/health.check"` |
| `token-refresh.ts` | 28 | `"memory/token.refresh"` |
| `delivery-recovery.ts` | 22 | `"memory/delivery.recovery"` |
| `connection-lifecycle.ts` | 32 | `"memory/connection.lifecycle"` |
| `ingest-delivery.ts` | 31 | `"memory/ingest.delivery"` |

### Inngest Event Names (10 distinct, ~30 reference sites)

Defined in `src/inngest/schemas/memory.ts`:

| Line | Event Name |
|---|---|
| 11 | `"memory/backfill.run.requested"` |
| 12 | `"memory/backfill.run.cancelled"` |
| 16 | `"memory/backfill.entity.requested"` |
| 31 | `"memory/health.check.requested"` |
| 42 | `"memory/connection.lifecycle"` |
| 51 | `"memory/webhook.received"` |
| 66 | `"memory/event.capture"` |
| 73 | `"memory/event.stored"` |
| 79 | `"memory/entity.upserted"` |
| 95 | `"memory/entity.graphed"` |

Referenced as triggers, cancelOn, step.sendEvent, and inngest.send across all function files (~30 sites).

### JWT Audience

| File | Line | String |
|---|---|---|
| `src/lib/jwt.ts` | 37 | `"lightfast-memory"` (setAudience) |
| `src/lib/jwt.ts` | 54 | `"lightfast-memory"` (verification) |
| `src/lib/jwt.test.ts` | 32 | `"lightfast-memory"` (test) |

### Data/Metadata Strings

| File | Line | String |
|---|---|---|
| `src/router/memory/connections.ts` | 191 | `"User-initiated disconnect via memory service"` |
| `src/router/memory/connections.ts` | 192 | `{ source: "memory_disconnect_handler" }` |

### Comments (~35 occurrences)

Spread across all files. Key examples:
- `src/index.ts:7` — `"Memory API exports"`
- `src/root.ts:2` — `"Memory service root router"`
- `src/root.ts:15` — `"Accessible via /api/trpc/memory/*"`
- `src/trpc.ts:2` — `"Memory service tRPC initialization"`
- `src/trpc.ts:50,71` — `"[trpc] memory service request"` (log strings)
- `src/trpc.ts:162` — `"console, platform, or other internal services calling memory"`
- `src/lib/jwt.ts:3` — `"console/platform to authenticate calls to memory service"`

### Inngest Function Display Names

| File | Line | Name |
|---|---|---|
| `memory-backfill-orchestrator.ts` | 34 | `"Memory Backfill Orchestrator"` |
| `memory-entity-worker.ts` | 34 | `"Memory Backfill Entity Worker"` |

---

## Part 3: Cross-Package References

### `packages/platform-trpc` (bridge layer — highest impact)

| File | Line | Reference | Kind |
|---|---|---|---|
| `src/server.tsx` | 1 | `import type { MemoryRouter } from "@api/platform"` | Type import |
| `src/server.tsx` | 3–5 | `createMemoryTRPCContext, memoryRouter, signServiceJWT` imports | Value imports |
| `src/server.tsx` | 22 | `createMemoryContext` | Function name |
| `src/server.tsx` | 27 | `signServiceJWT("console")` | String literal — caller identity |
| `src/server.tsx` | 41 | `memoryTrpc` | Exported const |
| `src/server.tsx` | 54 | `createMemoryCaller` with default `caller = "console"` | Function + default param |
| `src/caller.ts` | 8–9 | Same imports from `@api/platform` | Imports |
| `src/caller.ts` | 20 | `createMemoryCaller` with default `caller = "console"` | Function + default param |
| `src/react.tsx` | 3 | `import type { MemoryRouter }` | Type import |
| `src/react.tsx` | 22 | `createTRPCContext<MemoryRouter>()` | Type param |
| `src/react.tsx` | 47 | `MemoryTRPCReactProvider` | Component name |
| `src/react.tsx` | 69 | `${baseUrl}/api/trpc/memory` | URL path |
| `src/types.ts` | 4 | `import type { MemoryRouter }` | Type import |

### `packages/app-pinecone` ("console" naming)

| File | Line | Reference |
|---|---|---|
| `src/client.ts` | 26 | `ConsolePineconeClient` class |
| `src/client.ts` | 192 | `createConsolePineconeClient()` function |
| `src/client.ts` | 201 | `consolePineconeClient` singleton |
| `src/index.ts` | 24–27 | Re-exports all three + alias `pineconeClient` |

### `packages/app-api-key` ("console" naming)

| File | Line | Reference |
|---|---|---|
| `src/crypto.ts` | 33 | `API_KEY_PREFIX = "console_sk_"` (marked `@deprecated`) |

### `packages/app-clerk-m2m` ("console" naming)

| File | Line | Reference |
|---|---|---|
| `src/env.ts` | 23 | `consoleM2MEnv` |
| `src/index.ts` | 24 | Re-export of `consoleM2MEnv` |

### `core/ai-sdk` ("memory" as feature interface)

| File | Reference |
|---|---|
| `src/core/memory/index.ts` | `Memory<T>` interface, `InMemoryMemory`, `RedisMemory` exports |
| `src/core/memory/adapters/in-memory.ts` | `InMemoryMemory` class |
| `src/core/memory/adapters/redis.ts` | `RedisMemory` class |
| `src/core/server/error-classification.ts` | `LightfastErrorSource.Memory = "memory"` |
| `src/core/server/errors.ts` | `MemoryError` class, `toMemoryApiError()` function |
| `tsup.config.ts` | `memory` entry points |
| `package.json` | `./memory` exports |

### `apps/app` — Consumer References

| File | Line | Reference |
|---|---|---|
| `src/lib/proxy.ts` | 9 | `import { createMemoryCaller }` |
| `src/lib/proxy.ts` | 37, 266 | `await createMemoryCaller()` |
| `src/lib/proxy.ts` | 66, 267 | `memory.proxy.execute(...)` |
| `src/ai/runtime/memory.ts` | 22 | `AnswerRedisMemory implements Memory<>` |
| `src/app/(health)/api/health/route.ts` | 35 | `service: "console"` |
| `package.json` | 15 | `NEXT_PUBLIC_CONSOLE_PORT` |

### `apps/platform` — Route Handler

| File | Line | Reference |
|---|---|---|
| `src/app/api/trpc/[trpc]/route.ts` | 1 | `import { createMemoryTRPCContext, memoryRouter }` |
| `src/app/api/trpc/[trpc]/route.ts` | 51 | `router: memoryRouter` |
| `src/app/api/ingest/[provider]/route.ts` | 182 | `"memory/webhook.received"` event send |

### `apps/www`

| File | Line | Reference |
|---|---|---|
| `src/lib/related-projects.ts` | 8–12 | `consoleUrl` |
| `src/app/.../docs/(general)/layout.tsx` | 12, 19 | `consoleUrl` import and use |
| `src/app/.../docs/(api)/layout.tsx` | 12, 15 | `consoleUrl` import and use |

### `apps/app/next.config.ts` — URL Redirects

| Line | Redirect |
|---|---|
| 105 | `/features/memory` → `/` |
| 120–122 | changelog slug containing "neural-memory" |
| 125–127 | changelog slug containing "neural-memory" |

### Environment / Config

| File | Value |
|---|---|
| `apps/app/.vercel/.env.development.local:26` | `INNGEST_APP_NAME="lightfast-console"` |

### Inngest Event References Outside `@api/platform/`

| File | Line | Event |
|---|---|---|
| `apps/platform/src/app/api/ingest/[provider]/route.ts` | 182 | `"memory/webhook.received"` |
| `packages/app-test-data/src/trigger/trigger.ts` | 67 | `"memory/event.capture"` |

### Other Shared Packages

| Package | File | Reference |
|---|---|---|
| `packages/app-reserved-names` | `workspace-names.json:95` | `"console"` (reserved slug) |
| `packages/app-reserved-names` | `organization-names.json:84` | `"console"` (reserved name) |
| `packages/app-reserved-names` | `package.json:5` | `"Reserved workspace names for Lightfast Console"` |
| `packages/app-validation` | `src/primitives/ids.ts:124` | JSDoc example: `"console/docs.push"` |
| `packages/app-validation` | `src/schemas/job.ts:137` | JSDoc example: `"console/docs.push"` |
| `core/mcp` | `package.json:4,14` | `"Lightfast Neural Memory"` description/keyword |
| `core/lightfast` | `package.json:4,11` | `"Lightfast Neural Memory SDK"` description/keyword |
| `core/cli` | `package.json:13` | `"memory"` keyword |

---

## Blast Radius Summary

### "console" → "app" Rename

| Layer | Files | Occurrences |
|---|---|---|
| `@api/app/` internals | 4 | ~11 |
| `packages/platform-trpc` | 2 | 4 (caller default param + JWT signing) |
| `packages/app-pinecone` | 2 | 4 (class + function + singleton + re-exports) |
| `packages/app-api-key` | 1 | 1 (deprecated prefix) |
| `packages/app-clerk-m2m` | 2 | 2 (env object name) |
| `packages/app-reserved-names` | 3 | 3 (JSON + package.json description) |
| `packages/app-validation` | 2 | 2 (JSDoc examples) |
| `apps/app` | 3 | 3 (health check, env var, port) |
| `apps/www` | 3 | 3 (consoleUrl) |
| Env files | 1 | 1 (INNGEST_APP_NAME) |
| **Total** | **~23** | **~34** |

**Inngest impact**: 1 function ID (`console/record-activity`), 1 event name (`console/activity.record`). Existing Inngest function histories will not migrate — new IDs create new function entries in Inngest dashboard.

### "memory" → "platform" Rename

| Layer | Files | Occurrences |
|---|---|---|
| `@api/platform/` internals | ~15 | ~100+ |
| `packages/platform-trpc` | 4 | ~15 |
| `apps/app` consumer code | 3 | ~6 |
| `apps/platform` route handler | 2 | ~4 |
| `core/ai-sdk` | 7 | ~15 (interface + adapters + errors + exports) |
| `core/mcp` | 1 | 2 (description + keyword) |
| `core/lightfast` | 1 | 2 (description + keyword) |
| `core/cli` | 1 | 1 (keyword) |
| `packages/app-test-data` | 1 | 1 |
| `apps/app/next.config.ts` | 1 | 3 (redirects) |
| **Total** | **~36** | **~150+** |

**Inngest impact**: 11 function IDs, 10 event name schemas, ~30 event reference sites. This is the highest-risk area — all Inngest function histories and event routing depend on these strings.

**JWT impact**: `"lightfast-memory"` audience claim in JWT signing and verification. Both sides must change simultaneously or auth breaks.

**tRPC route impact**: `/api/trpc/memory` hardcoded in `packages/platform-trpc/src/react.tsx:69`. Client and server must change together.

### `core/ai-sdk` `Memory<T>` — Separate Concern

The `Memory<T>` interface in `core/ai-sdk` is a **generic AI-SDK concept** (conversation memory), not the platform service naming. Consider whether this should remain as-is (it's a valid domain concept) or also be renamed.

## Open Questions

1. Should `core/ai-sdk`'s `Memory<T>` interface be renamed? It represents conversation memory (an AI concept), not the platform service — it may be correct as-is.
2. Should the Inngest rename be done as a migration (old → new with temporary dual-registration) or a hard cut?
3. Should the deprecated `console_sk_` API key prefix in `packages/app-api-key` be preserved for backwards compatibility with existing keys, or can it be changed?
4. Should `consoleUrl` in `apps/www` become `appUrl` to match the new naming?
5. Should the reserved name `"console"` in workspace/org name lists remain (it's still a good name to reserve)?
