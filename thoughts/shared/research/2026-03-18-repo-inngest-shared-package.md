# Research: `@repo/inngest` Shared Package

**Date**: 2026-03-18
**Branch**: refactor/define-ts-provider-redesign

---

## Problem Statement

The Inngest client is instantiated twice — once in `apps/backfill/src/inngest/client.ts` and once in `api/console/src/inngest/client/client.ts`. Each client carries its own `eventsMap`, meaning the event schemas are siloed by service. The `@vendor/inngest` package already abstracts the raw `inngest` npm package, but neither service's event schemas nor typed client instance are shared.

The two event namespaces (`apps-console/*` and `apps-backfill/*`) are currently unknown to each other at the type level. Cross-service event sends (e.g. `console-test-data` sending to `apps-console/event.capture` via the console client) only work because the consumer happens to import directly from `@api/app/inngest/client`.

---

## Current State: Two Isolated Clients

### Client 1 — `apps/backfill/src/inngest/client.ts`

File: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/backfill/src/inngest/client.ts`

```
import { EventSchemas, Inngest } from "@vendor/inngest";   // line 3
export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromSchema(eventsMap),
});
```

No `middleware` array. No named `Events` type export.

**eventsMap keys and Zod shapes:**

| Event name | Shape |
|---|---|
| `apps-backfill/run.requested` | `backfillTriggerPayload` (imported from `@repo/app-providers/contracts`) |
| `apps-backfill/run.cancelled` | `{ installationId: z.string(), correlationId: z.string().max(128).optional() }` |
| `apps-backfill/entity.requested` | `{ installationId, provider, orgId, entityType, resource: { providerResourceId, resourceName }, since (datetime), depth (backfillDepthSchema), holdForReplay?: boolean, correlationId? }` |

### Client 2 — `api/console/src/inngest/client/client.ts`

File: `/Users/jeevanpillay/Code/@lightfastai/lightfast/api/console/src/inngest/client/client.ts`

```
import { sentryMiddleware } from "@inngest/middleware-sentry";  // line 1
import { env } from "@vendor/inngest/env";                      // line 4
import { EventSchemas, Inngest } from "inngest";                // line 6
const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  ...
  middleware: [sentryMiddleware()],
});
export type Events = GetEvents<typeof inngest>;
export { inngest };
```

Has `sentryMiddleware` and exports a `Events` type. Imports `Inngest` directly from bare `"inngest"` (not from `@vendor/inngest`).

**eventsMap keys and Zod shapes:**

| Event name | Shape |
|---|---|
| `apps-console/activity.record` | `{ workspaceId, category (enum: auth/workspace/integration/store/job/search/document/permission/api_key/settings), action, entityType, entityId, metadata?, relatedActivityId?, timestamp (datetime) }` |
| `apps-console/event.capture` | `{ workspaceId, clerkOrgId?, sourceEvent (postTransformEventSchema), ingestionSource? (ingestionSourceSchema), ingestLogId?, correlationId? }` |
| `apps-console/event.stored` | `{ workspaceId, clerkOrgId, eventExternalId, sourceType, significanceScore (number) }` |
| `apps-console/entity.upserted` | `{ workspaceId, entityExternalId, entityType, provider, internalEventId (number), entityRefs: Array<{ type, key, label? }>, occurredAt, correlationId? }` |
| `apps-console/entity.graphed` | `{ workspaceId, entityExternalId, entityType, provider, occurredAt, correlationId? }` |

---

## Environment Variable Comparison

### `@vendor/inngest/env` (`vendor/inngest/env.ts`)

The canonical env schema used by `api/console`:

```typescript
INNGEST_APP_NAME: z.string().min(1).startsWith("lightfast-"),
INNGEST_EVENT_KEY: z.string().min(1).optional(),
INNGEST_SIGNING_KEY: z.string().min(1).startsWith("signkey-").optional(),
```

### `apps/backfill/src/env.ts`

Defines identical Zod shapes inline within `createEnv()`:

```typescript
INNGEST_APP_NAME: z.string().min(1).startsWith("lightfast-"),
INNGEST_EVENT_KEY: z.string().min(1).optional(),
INNGEST_SIGNING_KEY: z.string().min(1).startsWith("signkey-").optional(),
```

**Finding:** The three variables (`INNGEST_APP_NAME`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`) have **identical Zod schemas** in both services. Backfill re-declares them locally; console delegates to `@vendor/inngest/env`. The `@vendor/inngest` package already has the canonical schema — backfill simply doesn't use it.

### `api/console/src/env.ts`

The console API's `env.ts` does **not** declare the three Inngest vars at all. They are pulled in transitively via `@vendor/inngest/env` inside `api/console/src/inngest/client/client.ts` (line 4: `import { env } from "@vendor/inngest/env"`).

---

## `@vendor/inngest` Package Structure

Package: `/Users/jeevanpillay/Code/@lightfastai/lightfast/vendor/inngest/package.json`

Exports:
- `.` → re-exports `EventSchemas`, `Inngest`, `InngestMiddleware`, `NonRetriableError`, `RetryAfterError` from bare `inngest`
- `./server` → (separate server entry)
- `./hono` → re-exports `serve` from `inngest/hono`
- `./env` → `createEnv()` with the three Inngest env vars

The `@vendor/inngest` package uses `tsc` for its build (not `tsup`). It has no `sideEffects` field.

---

## All Import Sites

### Backfill service (`apps/backfill`)

| File | Import |
|---|---|
| `apps/backfill/src/inngest/client.ts:3` | `import { EventSchemas, Inngest } from "@vendor/inngest"` |
| `apps/backfill/src/routes/inngest.ts:1` | `import { serve } from "@vendor/inngest/hono"` |
| `apps/backfill/src/routes/inngest.ts:4` | `import { inngest } from "../inngest/client.js"` |
| `apps/backfill/src/routes/trigger.ts:8` | `import { inngest } from "../inngest/client.js"` |
| `apps/backfill/src/workflows/entity-worker.ts:7` | `import { NonRetriableError } from "@vendor/inngest"` |
| `apps/backfill/src/workflows/entity-worker.ts:10` | `import { inngest } from "../inngest/client.js"` |
| `apps/backfill/src/workflows/backfill-orchestrator.ts:6` | `import { NonRetriableError } from "@vendor/inngest"` |
| `apps/backfill/src/workflows/backfill-orchestrator.ts:9` | `import { inngest } from "../inngest/client.js"` |

### Console API (`api/console`)

| File | Import |
|---|---|
| `api/console/src/inngest/client/client.ts:4` | `import { env } from "@vendor/inngest/env"` |
| `api/console/src/inngest/client/client.ts:6` | `import { EventSchemas, Inngest } from "inngest"` (bare, not via `@vendor`) |
| `api/console/src/inngest/index.ts:6` | `import { inngest } from "./client/client"` (re-exports) |
| `api/console/src/lib/activity.ts:35` | `import { inngest } from "../inngest/client/client"` |
| `api/console/src/inngest/workflow/neural/event-store.ts:41` | `import { NonRetriableError } from "inngest"` (bare) |
| `api/console/src/inngest/workflow/neural/entity-embed.ts:25` | `import { NonRetriableError } from "inngest"` (bare) |

### Console app (`apps/console`)

| File | Import |
|---|---|
| `apps/console/src/app/(inngest)/api/inngest/route.ts:8` | `import { createInngestRouteContext } from "@api/app/inngest"` |
| `apps/console/src/app/api/gateway/ingress/_lib/notify.ts:1` | `import { inngest } from "@api/app/inngest"` |

### Test data package (`packages/console-test-data`)

| File | Import |
|---|---|
| `packages/console-test-data/src/trigger/trigger.ts:8` | `import { inngest } from "@api/app/inngest/client"` |

---

## `@api/app` Export Map (inngest-relevant entries)

From `api/console/package.json`:

```json
"./inngest": {
  "types": "./dist/inngest/index.d.ts",
  "default": "./src/inngest/index.ts"
},
"./inngest/client": {
  "types": "./dist/inngest/client/client.d.ts",
  "default": "./src/inngest/client/client.ts"
}
```

The `@api/app/inngest` export re-exports `inngest`, `createInngestRouteContext`, and all workflow functions. The `@api/app/inngest/client` export is a direct path to the raw client instance (used by `console-test-data`).

---

## Package Structure Templates

### `@repo/app-providers` pattern (tsup-based, multi-entry)

`packages/console-providers/tsup.config.ts`:
```typescript
export default defineConfig({
  entry: { index: "src/index.ts", client: "src/client.ts", contracts: "src/contracts.ts" },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
```

`packages/console-providers/package.json` shape:
- `"type": "module"`, `"sideEffects": false`
- `"build": "tsup && tsc --incremental false"` — tsup for JS, tsc for type declarations
- `"dev": "tsc --watch"`
- `"typecheck": "tsc --noEmit"`
- exports map with per-entry `types`/`default` pairs

### `@repo/app-validation` pattern (tsup, deeper directory entries)

Same tsup+tsc build pattern. Multiple sub-path entries like `./primitives`, `./schemas`, `./forms`.

### `@vendor/inngest` pattern (tsc-only, no tsup)

`"build": "tsc"` — produces `.d.ts` alongside `.js` in `dist/`. Simpler but no code splitting.

---

## `pnpm-workspace.yaml` — Package Registration

New packages under `packages/` are automatically picked up by the `packages: - packages/*` glob. No manual registration needed for `packages/inngest`.

The catalog entry for `inngest` already exists:
```yaml
inngest: ^3.52.6
```

And `@inngest/middleware-sentry` is also cataloged:
```yaml
'@inngest/middleware-sentry': ^0.1.2
```

---

## `turbo.json` — Pipeline

The existing `"build": { "dependsOn": ["^build"] }` rule covers all packages. No new task types are needed for `@repo/inngest`. The `typecheck` task also covers it via `"dependsOn": ["^build", "transit"]`.

The `boundaries.tags` rules in `turbo.json` are relevant:
- `packages` tag: can depend on `vendor` packages (allowed)
- `app` tag: cannot be depended on by `vendor`/`packages`/etc. (so `@repo/inngest` cannot import from `@api/app` or `@lightfast/*` apps — which it doesn't need to)

---

## Proposed `packages/inngest` Structure

Based on the patterns above, the new package would live at `packages/inngest/` with name `@repo/inngest`.

### Key design decisions from the research

1. **Build toolchain**: tsup + tsc (matching `@repo/app-providers`), since the package needs clean ESM output and type declarations separate from JS emit.

2. **Entry points needed**:
   - `./schemas` — exports both `eventsMap` objects (or a merged map) as Zod schemas
   - `./client` — exports the typed `Inngest` instance factory or pre-built clients (requires env wiring decision)
   - `./backfill` — backfill-specific event schemas
   - `./console` — console-specific event schemas

3. **Dependencies**:
   - `@vendor/inngest: workspace:*` — for `EventSchemas`, `Inngest`, env
   - `@inngest/middleware-sentry: catalog:` — currently only used by console client
   - `@repo/app-providers: workspace:*` — for `backfillTriggerPayload`, `backfillDepthSchema`, `postTransformEventSchema`
   - `@repo/app-validation: workspace:*` — for `ingestionSourceSchema`
   - `zod: catalog:`

4. **The middleware asymmetry**: The backfill client has no middleware; the console client has `sentryMiddleware()`. If a shared factory is used, middleware injection needs to be parameterized.

5. **Env sourcing**: Both services use the same three env vars with identical validation. The `@vendor/inngest/env` export already provides the canonical schema. The new package can re-export or extend it.

6. **`INNGEST_APP_NAME` values**: Both services validate `startsWith("lightfast-")` but the actual runtime value is service-specific (e.g., `lightfast-console` vs `lightfast-backfill`). The `id` passed to `new Inngest({ id: env.INNGEST_APP_NAME })` must remain per-service.

---

## Import Sites That Need Updating

If `@repo/inngest` centralizes schemas and/or the client factory, the following files need updating:

**`apps/backfill/src/inngest/client.ts`** — replace local `eventsMap` + `new Inngest(...)` with imports from `@repo/inngest`

**`api/console/src/inngest/client/client.ts`** — replace local `eventsMap` + `new Inngest(...)` with imports from `@repo/inngest`

**`apps/backfill/src/workflows/entity-worker.ts`** and **`backfill-orchestrator.ts`** — `NonRetriableError` currently from `@vendor/inngest`; could stay there or be re-exported from `@repo/inngest`

**`api/console/src/inngest/workflow/neural/event-store.ts`** and **`entity-embed.ts`** — `NonRetriableError` from bare `"inngest"`; should be normalised to `@vendor/inngest` or `@repo/inngest`

All other consumer files (`routes/trigger.ts`, `routes/inngest.ts`, `apps/console/src/app/(inngest)/...`, etc.) import from the local client or from `@api/app/inngest`, so they are unaffected if the internal wiring of `api/console` is updated in place.

The one cross-package consumer is `packages/console-test-data/src/trigger/trigger.ts` which imports directly from `@api/app/inngest/client`. If the console client is refactored to delegate to `@repo/inngest`, this import path remains valid (it still resolves through `@api/app`).

---

## Summary Table

| Aspect | Backfill | Console |
|---|---|---|
| Client file | `apps/backfill/src/inngest/client.ts` | `api/console/src/inngest/client/client.ts` |
| Inngest import source | `@vendor/inngest` | bare `inngest` |
| Env source | local `env.ts` inline | `@vendor/inngest/env` |
| Middleware | none | `sentryMiddleware()` |
| Event prefix | `apps-backfill/` | `apps-console/` |
| Events type export | no | `export type Events` |
| Consumers of client | 4 files (all relative) | 3 files (2 relative, 1 via `@api/app`) |
| Build tool | tsup | tsc |
