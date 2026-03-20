---
date: 2026-03-18T00:00:00+11:00
researcher: claude
git_commit: a3a9f2d67c9535c5fc01fe2a9be59e52bcba647e
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "console-providers entry-point architecture: client/server layers, wire.ts, types folder"
tags: [research, codebase, console-providers, display, wire, schemas, client-server-split]
status: complete
last_updated: 2026-03-18
---

# Research: `@repo/app-providers` Entry-Point Layers

**Date**: 2026-03-18
**Git Commit**: `a3a9f2d67c9535c5fc01fe2a9be59e52bcba647e`
**Branch**: `refactor/define-ts-provider-redesign`

## Research Question

The package currently has two export entry points — a server-only main barrel and a client-safe `./display` sub-path. Several client components are importing runtime values (categories, event labels, backfill options) from the server-only barrel. The question is whether the existing two-layer architecture should be expanded — either by growing `display.ts` or by introducing a third structural layer (e.g., `./schemas` or a `src/types/` folder) to correctly house cross-service Zod schemas like `wire.ts`, `gateway.ts`, and `types.ts`.

---

## Summary

`@repo/app-providers` exports exactly two compiled entry points: `.` (server-only) and `./display` (client-safe). The `import "server-only"` guard on `index.ts` makes any client bundle import a **build-time error**. However, three values that live deep inside the server barrel — `BACKFILL_DEPTH_OPTIONS`, `PROVIDERS[p].categories`, and `EVENT_REGISTRY` — contain only pure static data with zero server runtime dependencies. They are in server files because the files they share with server-only machinery (`@noble/ed25519`, `@t3-oss/env-core`, provider index.ts factories).

Separately, `wire.ts`, `backfill-contracts.ts`, `gateway.ts`, `types.ts`, and `post-transform-event.ts` are all cross-service Zod schemas used by relay, backfill, and gateway services. Of these, `gateway.ts`, `types.ts`, and `post-transform-event.ts` have **zero server dependencies** (only `zod`). `wire.ts` and `backfill-contracts.ts` have **avoidable transitive server deps** — they import through `registry.ts` purely to reach `providerSlugSchema` and `backfillDepthSchema`, both of which originate in `display.ts` or could.

---

## Detailed Findings

### Current Entry Points (`package.json:8-17`)

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  },
  "./display": {
    "types": "./dist/display.d.ts",
    "default": "./dist/display.js"
  }
}
```

**tsup.config.ts:3-13** builds exactly these two entry points from `src/index.ts` and `src/display.ts`. Types are produced by the `tsc --incremental false` second step (`dts: false` in tsup).

---

### Source File Dependency Map

Every file in `src/` classified by its runtime dependency profile:

#### Truly Client-Safe (only `zod` and/or each other)

| File | Exports | External deps |
|---|---|---|
| `icon.ts` | `IconDef`, `iconDefSchema` | `zod` only |
| `display.ts` | `PROVIDER_DISPLAY`, `ProviderSlug`, `ProviderDisplayEntry`, `providerSlugSchema`, `providerDisplayEntrySchema` | `zod`, `./icon` |
| `post-transform-event.ts` | `PostTransformEvent`, `entityRefSchema`, `entityRelationSchema`, `postTransformEventSchema` | `zod` only |
| `gateway.ts` | `GatewayConnection`, `GatewayTokenResult`, `ProxyEndpointsResponse` + schemas | `zod` only |
| `types.ts` | `TransformContext`, `OAuthTokens`, `BaseProviderAccountInfo`, `CallbackResult`, `EdgeRule`, `syncSchema` | `zod` only |

#### Cross-Service Schemas with **Avoidable** Server Deps

| File | Problem Import | What it actually needs |
|---|---|---|
| `wire.ts` | `sourceTypeSchema from ./registry` | Only `providerSlugSchema` (in `display.ts`) |
| `backfill-contracts.ts` | `sourceTypeSchema from ./registry` + `backfillDepthSchema from ./define` | `providerSlugSchema` from `display.ts` + `backfillDepthSchema` (a simple `z.union([z.literal(1),…])`) |

Both files import through `registry.ts`, which pulls in all five provider `index.ts` files and everything they transitively depend on (`@noble/ed25519`, `@t3-oss/env-core`, etc.). The actual values they need are far shallower.

#### Hard Server-Only (function-containing runtime machinery)

| File | Server dep | Why |
|---|---|---|
| `define.ts` | `@noble/ed25519`, `@t3-oss/env-core`, `./crypto` | Ed25519 verify, env validation, HMAC factories |
| `crypto.ts` | `@noble/hashes` | SHA-256/SHA-1 HMAC computation |
| `jwt.ts` | `jose` | RS256 JWT signing |
| `sanitize.ts` | (none — likely pure, but inside server barrel) | String sanitisation |
| `event-normalization.ts` | none — but imports from define chain | Observation type mapping |
| `dispatch.ts` | `./define`, `./registry` | Payload transformation |
| `validation.ts` | `./define`, `./post-transform-event` | Zod validation helpers |

#### Provider Implementations (all server-only via define.ts factories)

`providers/{github,linear,sentry,vercel,apollo}/index.ts` — each calls `defineWebhookProvider()` or `defineApiProvider()` from `define.ts`, which imports `@noble/ed25519` and `@t3-oss/env-core`. All are transitively server-only.

`providers/*/auth.ts`, `providers/*/schemas.ts`, `providers/*/api.ts`, `providers/*/transformers.ts`, `providers/*/backfill.ts` — also inside the server dependency chain.

#### Registry (server-only aggregation)

`registry.ts` — imports all five provider `index.ts` files directly. Builds `PROVIDERS`, `EVENT_REGISTRY`, `providerAccountInfoSchema`, `providerConfigSchema`, all endpoint types, and `PROVIDER_ENVS()`. Server-only.

---

### Pure Static Data Stranded in Server Files

Three values needed by client components have no server dependencies of their own, but are stuck inside server files:

#### 1. `BACKFILL_DEPTH_OPTIONS` (`define.ts:474-476`)
```typescript
export const BACKFILL_DEPTH_OPTIONS = [1, 7, 30, 90] as const satisfies readonly z.infer<typeof backfillDepthSchema>[];
```
A four-element literal array. The only reason it is in `define.ts` is that `backfillDepthSchema` is also there.
Used by: `source-settings-form.tsx` (lines 51, 143, 154) — `PROVIDERS[provider].categories` colocated in same import.

#### 2. `PROVIDERS[p].categories` (per-provider `index.ts`)
Pure static objects:
```typescript
categories: {
  pull_request: { label: "Pull Requests", description: "...", type: "observation" },
  issues: { label: "Issues", description: "...", type: "observation" },
}
```
Every category entry is `{ label: string, description: string, type: "observation" | "sync+observation" }`. No functions, no env vars, no server deps. Stranded inside `defineWebhookProvider()` call in provider index files.
Used by: `source-settings-form.tsx` (line 40), `debug-panel-content.tsx` (line 28).

#### 3. `EVENT_REGISTRY` labels (`registry.ts:99-126`)
The full `EVENT_REGISTRY` is a `Record<EventKey, EventRegistryEntry>` derived from `PROVIDERS`. Client components use only the `label` field:
```typescript
// event-row.tsx:42-45
const eventLabel = (EVENT_REGISTRY as Record<string, { label: string } | undefined>)[
  `${event.source}:${event.sourceType}`
]?.label ?? event.sourceType;
```
The label values are literals in provider event definitions. Stranded inside `registry.ts` which requires all provider index files.
Used by: `event-row.tsx` (lines 42-45), `debug-panel-content.tsx` (lines 34-41).

---

### Client Components: Import Status

| File | What it imports | From | Status |
|---|---|---|---|
| `sources-section-loading.tsx` | `PROVIDER_DISPLAY` | `"@repo/app-providers"` (main) | Wrong path — data already in `display.ts` |
| `source-settings-form.tsx` | `BACKFILL_DEPTH_OPTIONS`, `PROVIDERS[p].categories`, `CategoryDef`, `SourceType` | `"@repo/app-providers"` (main) | Needs client-safe equivalents |
| `event-row.tsx` | `EVENT_REGISTRY` (label only), `PostTransformEvent` type | `"@repo/app-providers"` (main) + `"@repo/app-providers/display"` | Needs client-safe label map |
| `debug-panel-content.tsx` | `PROVIDERS[p].categories`, `EVENT_REGISTRY`, `SourceType` | `"@repo/app-providers"` (main) + `"@repo/app-providers/display"` | Needs client-safe equivalents |

All four client-side consumers follow the same pattern: they need display/label data that is conceptually client-safe but physically co-located with server machinery.

---

### Non-Client-Component Imports from Main Barrel

`event-row.tsx` and `debug-panel-content.tsx` split their imports — `PROVIDER_DISPLAY` from `./display`, `EVENT_REGISTRY`/`PROVIDERS` from the main barrel. The other 13 files that import from the main barrel are API routes or server components and are not affected by the `server-only` guard.

Full list of main barrel importers in `apps/console/src/`:
- `app/api/gateway/ingress/route.ts` — server
- `app/api/gateway/ingress/_lib/transform.ts` — server
- `app/api/gateway/ingress/_lib/notify.ts` — server
- `app/api/debug/inject-event/route.ts` — server
- `app/api/debug/inject-event/_lib/schemas.ts` — server
- `app/api/debug/inject-event/_lib/context.ts` — server
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/page.tsx` — check needed
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/page.tsx` — check needed
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/provider-source-item.tsx` — check needed
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx` — check needed
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/source-selection-provider.tsx` — check needed
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/events-table.tsx` — check needed
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-detail.tsx` — check needed

---

### `wire.ts` and `backfill-contracts.ts`: The Cross-Service Schema Problem

`wire.ts` imports `sourceTypeSchema` from `./registry`:
```typescript
// wire.ts:9
import { sourceTypeSchema } from "./registry";
```
But `registry.ts` re-exports this as:
```typescript
// registry.ts:32
export { providerSlugSchema as sourceTypeSchema } from "./display";
```
`sourceTypeSchema` is just `providerSlugSchema` — a `z.enum(["apollo","github","vercel","linear","sentry"])` that lives in `display.ts`. The indirection through `registry.ts` pulls in all five provider implementations.

`backfill-contracts.ts` has the same transitive problem:
```typescript
// backfill-contracts.ts:9-10
import { backfillDepthSchema } from "./define";
import { sourceTypeSchema } from "./registry";
```
`backfillDepthSchema` is `z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)])` in `define.ts`. Both imports are shallower than their current source files.

---

### Provider Category Data (for `PROVIDER_CATEGORIES` extraction)

Extracted from each provider's `index.ts`:

**GitHub** (`providers/github/index.ts:77-88`):
```typescript
categories: {
  pull_request: { label: "Pull Requests", description: "Capture PR opens, merges, closes, and reopens", type: "observation" },
  issues: { label: "Issues", description: "Capture issue opens, closes, and reopens", type: "observation" },
}
```

**Linear** (`providers/linear/index.ts:175-206`):
```typescript
categories: {
  Issue: { label: "Issues", description: "Capture issue creates, updates, and deletes", type: "observation" },
  Comment: { label: "Comments", description: "Capture comment activity on issues", type: "observation" },
  IssueLabel: { label: "Issue Labels", description: "Capture issue label changes", type: "observation" },
  Project: { label: "Projects", description: "Capture project lifecycle events", type: "observation" },
  Cycle: { label: "Cycles", description: "Capture sprint/cycle lifecycle events", type: "observation" },
  ProjectUpdate: { label: "Project Updates", description: "Capture project status updates", type: "observation" },
}
```

**Sentry** (`providers/sentry/index.ts:108-135`):
```typescript
categories: {
  issue: { label: "Issues", description: "Capture issue state changes (created, resolved, assigned, ignored)", type: "observation" },
  error: { label: "Errors", description: "Capture individual error events", type: "observation" },
  comment: { label: "Comments", description: "Capture issue comment activity", type: "observation" },
  event_alert: { label: "Event Alerts", description: "Capture event alert rule triggers", type: "observation" },
  metric_alert: { label: "Metric Alerts", description: "Capture metric alert triggers and resolutions", type: "observation" },
}
```

**Vercel** (`providers/vercel/index.ts:84-115`) — dot-namespaced keys:
```typescript
categories: {
  "deployment.created": { label: "Deployment Started", description: "...", type: "observation" },
  "deployment.succeeded": { label: "Deployment Succeeded", description: "...", type: "observation" },
  "deployment.ready": { label: "Deployment Ready", description: "...", type: "observation" },
  "deployment.error": { label: "Deployment Failed", description: "...", type: "observation" },
  "deployment.canceled": { label: "Deployment Canceled", description: "...", type: "observation" },
  "deployment.check-rerequested": { label: "Check Re-requested", description: "...", type: "observation" },
}
```

**Apollo** (`providers/apollo/index.ts:21`): `categories: {}` (empty — API-only provider, no sync events)

---

### Event Labels for `EVENT_LABELS` Flat Map

Derived from provider event definitions (for a hypothetical `EVENT_LABELS: Record<string, string>`):

**GitHub** (all `actionEvent`):
- `github:pull_request.opened` → "PR Opened"
- `github:pull_request.closed` → "PR Closed"
- `github:pull_request.merged` → "PR Merged"
- `github:pull_request.reopened` → "PR Reopened"
- `github:pull_request.ready-for-review` → "Ready for Review"
- `github:issues.opened` → "Issue Opened"
- `github:issues.closed` → "Issue Closed"
- `github:issues.reopened` → "Issue Reopened"

**Linear** (all `actionEvent`):
- `linear:Issue.created` → "Issue Created" / `linear:Issue.updated` → "Issue Updated" / `linear:Issue.deleted` → "Issue Deleted"
- `linear:Comment.created` → "Comment Added" / etc.
- `linear:Project.created` → "Project Created" / etc.
- `linear:Cycle.created` → "Cycle Created" / etc.
- `linear:ProjectUpdate.created` → "Project Update Posted" / etc.

**Sentry** (mix):
- `sentry:issue.created` → "Issue Created" / `.resolved` → "Issue Resolved" / `.assigned` → "Issue Assigned" / `.ignored` → "Issue Ignored" / `.archived` → "Issue Archived" / `.unresolved` → "Issue Unresolved"
- `sentry:error` → "Errors"
- `sentry:event_alert` → "Event Alerts"
- `sentry:metric_alert` → "Metric Alerts"

**Vercel** (single `actionEvent` with 6 actions):
- `vercel:deployment.created` → "Deployment Started"
- `vercel:deployment.succeeded` → "Deployment Succeeded"
- `vercel:deployment.ready` → "Deployment Ready"
- `vercel:deployment.error` → "Deployment Failed"
- `vercel:deployment.canceled` → "Deployment Canceled"
- `vercel:deployment.check-rerequested` → "Deployment Check Re-requested"

---

## Architecture Documentation

### Current Two-Layer Model

```
@repo/app-providers           → dist/index.js    (import "server-only")
  └─ re-exports: define.ts, registry.ts, wire.ts, gateway.ts, types.ts,
     backfill-contracts.ts, post-transform-event.ts, providers/*, crypto.ts,
     jwt.ts, sanitize.ts, event-normalization.ts, dispatch.ts, validation.ts

@repo/app-providers/display   → dist/display.js  (no guard — client-safe)
  └─ re-exports: display.ts only
```

### Dependency Graph (simplified)

```
display.ts ←─────────────── icon.ts
    ↑                           ↑
registry.ts ←──── providers/*/index.ts ←── define.ts ←── crypto.ts
    ↑                                           ↑           ↑ (@noble/*)
wire.ts ──────────────────────────────────────── ↑ (only needs providerSlugSchema from display.ts)
backfill-contracts.ts ─────────────────────────── ↑ (only needs backfillDepthSchema + providerSlugSchema)

gateway.ts        ← zod only
types.ts          ← zod only
post-transform-event.ts ← zod only
```

### Files Purely Used by Cross-Service Consumers (relay, backfill, gateway apps)

- `wire.ts` — relay + console ingress (webhook envelope contract)
- `backfill-contracts.ts` — console tRPC + backfill service
- `gateway.ts` — gateway service clients
- `post-transform-event.ts` — relay dispatch + console ingress

These are conceptually "wire/contract" files, not "provider runtime" files. They currently live inside the server barrel by default but have no inherent server dependency.

---

## Open Questions

1. **New export entry point or expanded `display.ts`?** — Should `BACKFILL_DEPTH_OPTIONS`, `PROVIDER_CATEGORIES`, and `EVENT_LABELS` be added directly to `display.ts` (growing the single client-safe entry), or should there be a second client-safe entry point (e.g., `./client`) that imports from `display.ts` and adds these derived constants?

2. **`./schemas` third entry point** — Should `wire.ts`, `gateway.ts`, `types.ts`, `backfill-contracts.ts`, and `post-transform-event.ts` form a third export entry point `@repo/app-providers/schemas` (or `/contracts`) that is neither server-only nor display-only — usable in both environments? This requires fixing the transitive deps in `wire.ts` and `backfill-contracts.ts` to import `providerSlugSchema` from `./display` directly rather than through `./registry`.

3. **`src/types/` or `src/schemas/` folder** — Should the five pure-Zod cross-env files be reorganised into a `src/schemas/` subfolder with their own index? This is a structural change to how files are laid out (not just what gets exported).

4. **`backfillDepthSchema` location** — If `backfill-contracts.ts` is to be made client/cross-env safe, `backfillDepthSchema` (currently in `define.ts`) needs to either move to `display.ts` or be placed in a shared primitives file. Moving it to `display.ts` would allow `BACKFILL_DEPTH_OPTIONS` to move there too (it is defined as `[1,7,30,90] as const satisfies readonly z.infer<typeof backfillDepthSchema>[]`).

5. **tsup config changes** — Any new entry points require adding to the `entry` map in `tsup.config.ts` and a matching `"exports"` key in `package.json`.
