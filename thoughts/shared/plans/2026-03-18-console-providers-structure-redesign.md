# `console-providers` Structure Redesign — Implementation Plan

## Overview

Reorganize `@repo/console-providers` from a two-entry flat-file package into a folder-structured, audience-named package. Replace the opaque `./display` / `"."` split with **`./client`** (browser-safe), **`./contracts`** (cross-service Zod schemas), and **`"."** (server runtime). Decompose the 1,129-line `define.ts` monolith into purpose-named files organized by the provider-author vocabulary. All existing functionality is preserved; no type-system semantics change.

Builds on the Phase 9 state of `thoughts/shared/plans/2026-03-18-provider-architecture-redesign.md`.

---

## Current State Analysis

```
packages/console-providers/src/
├── define.ts               ← 1,129 lines, 6 unrelated concerns
├── registry.ts             ← PROVIDERS, EVENT_REGISTRY, derived types
├── index.ts                ← server-only barrel (import "server-only"), ~400 lines
├── display.ts              ← client-safe; only PROVIDER_DISPLAY + providerSlugSchema
├── icon.ts                 ← SVG icon type
├── types.ts                ← TransformContext, OAuthTokens, BaseProviderAccountInfo, EdgeRule, etc.
├── post-transform-event.ts ← canonical output event shape
├── event-normalization.ts  ← deriveObservationType, getBaseEventType
├── dispatch.ts             ← transformWebhookPayload
├── validation.ts           ← PostTransformEvent validation helpers
├── sanitize.ts             ← string truncation, HTML encoding
├── crypto.ts               ← computeHmac, sha256Hex, timingSafeEqual
├── jwt.ts                  ← createRS256JWT
├── gateway.ts              ← GatewayConnection, GatewayTokenResult, ProxyEndpointsResponse
├── wire.ts                 ← WebhookEnvelope (imports through registry → all providers)
├── backfill-contracts.ts   ← BackfillTriggerPayload (imports through define + registry)
└── providers/{github,linear,sentry,vercel,apollo}/
```

### Problems

1. **Entry point naming** — `./display` doesn't convey "safe for browsers". `"."` doesn't convey "server runtime". New developers don't know which to pick without reading source.

2. **`define.ts` is unmaintainable** — Six unrelated concerns in 1,129 lines: discriminant enums, event type system, HMAC/Ed25519 crypto runtime, auth strategy interfaces, backfill types, provider factory functions + env wiring.

3. **Client-safe data stranded behind `server-only`** — `BACKFILL_DEPTH_OPTIONS`, provider `categories`, event labels are pure static objects trapped in server files because they co-locate with server machinery.

4. **Cross-service schemas trapped by transitive deps** — `wire.ts` only needs `providerSlugSchema` (in `display.ts`) but imports through `registry.ts` → all 5 providers → `@noble/ed25519`, `@t3-oss/env-core`. Same for `backfill-contracts.ts`.

5. **Flat barrel** — `index.ts` re-exports 300+ symbols with no grouping. Impossible to scan.

---

## Desired End State

```
packages/console-providers/src/
│
├── client.ts               ← entry: @repo/console-providers/client
├── contracts.ts            ← entry: @repo/console-providers/contracts
├── index.ts                ← entry: @repo/console-providers (server-only)
│
├── client/                 ← browser-safe static data
│   ├── display.ts          ← PROVIDER_DISPLAY, ProviderSlug, providerSlugSchema
│   ├── categories.ts       ← PROVIDER_CATEGORIES, CategoryDef
│   ├── event-labels.ts     ← EVENT_LABELS flat map
│   └── options.ts          ← backfillDepthSchema, BACKFILL_DEPTH_OPTIONS
│
├── contracts/              ← cross-service Zod schemas (imports from client/ only)
│   ├── event.ts            ← PostTransformEvent, EntityRef, EntityRelation
│   ├── wire.ts             ← WebhookEnvelope, ServiceAuthWebhookBody
│   ├── gateway.ts          ← GatewayConnection, GatewayTokenResult, ProxyEndpointsResponse
│   └── backfill.ts         ← BackfillTriggerPayload, BackfillEstimatePayload
│
├── provider/               ← provider type system (replaces define.ts)
│   ├── kinds.ts            ← providerKindSchema, authKindSchema, categoryDefSchema, actionDefSchema
│   ├── events.ts           ← SimpleEventDef, ActionEventDef, simpleEvent(), actionEvent()
│   ├── auth.ts             ← OAuthDef, ApiKeyDef, AppTokenDef, AuthDef, isAppTokenAuth
│   ├── webhook.ts          ← WebhookDef, SignatureScheme, hmac(), ed25519(), ManagedWebhookDef
│   ├── api.ts              ← ApiEndpoint, ProviderApi, RateLimit, ProxyExecuteRequest/Response
│   ├── backfill.ts         ← BackfillDef, BackfillEntityHandler, BackfillContext, typedEntityHandler
│   ├── resource-picker.ts  ← ResourcePickerDef, NormalizedInstallation, NormalizedResource
│   ├── shape.ts            ← WebhookProvider, ManagedProvider, ApiProvider, ProviderDefinition, guards
│   ├── primitives.ts       ← absorbs types.ts (TransformContext, OAuthTokens, BaseProviderAccountInfo, etc.)
│   └── index.ts            ← re-exports all above
│
├── runtime/                ← server-only machinery
│   ├── verify/
│   │   ├── hmac.ts         ← _deriveHmacVerify (internal)
│   │   ├── ed25519.ts      ← _deriveEd25519Verify (internal)
│   │   └── index.ts        ← deriveVerifySignature (public)
│   ├── crypto.ts           ← computeHmac, sha256Hex, timingSafeEqual
│   ├── jwt.ts              ← createRS256JWT
│   ├── env.ts              ← buildEnvGetter
│   ├── sanitize.ts         ← string sanitization
│   ├── dispatch.ts         ← transformWebhookPayload
│   ├── validation.ts       ← validatePostTransformEvent
│   └── event-norm.ts       ← deriveObservationType, getBaseEventType
│
├── factory/                ← "write me a provider" API
│   ├── webhook.ts          ← defineWebhookProvider
│   ├── api.ts              ← defineApiProvider
│   ├── managed.ts          ← defineManagedProvider
│   └── index.ts            ← re-exports all three
│
├── registry.ts             ← PROVIDERS, EVENT_REGISTRY, derived schemas (unchanged location)
├── icon.ts                 ← unchanged
└── providers/              ← unchanged structure
    ├── github/
    ├── linear/
    ├── sentry/
    ├── vercel/
    └── apollo/
```

### Dependency Graph (strict DAG, no cycles)

```
icon.ts
  ↑
client/  ← icon.ts, zod only
  ↑
contracts/  ← client/ (providerSlugSchema, backfillDepthSchema), zod
  ↑
provider/  ← contracts/event.ts, client/display.ts (ProviderDisplayEntry), provider/primitives.ts
  ↑
runtime/  ← provider/webhook.ts (SignatureScheme), runtime/crypto.ts, @noble/ed25519, jose
factory/  ← provider/, runtime/env.ts, @t3-oss/env-core
  ↑
providers/*  ← factory/, provider/, runtime/
  ↑
registry.ts  ← providers/*, client/display.ts
```

### Consumer mapping (new entry points)

| Was | Becomes |
|-----|---------|
| `@repo/console-providers/display` | `@repo/console-providers/client` |
| `@repo/console-providers` (for `PostTransformEvent`, `WebhookEnvelope`, `GatewayConnection`, etc.) | `@repo/console-providers/contracts` |
| `@repo/console-providers` (for `PROVIDERS`, `getProvider`, `deriveVerifySignature`, etc.) | `@repo/console-providers` (unchanged) |

### Verification

```bash
pnpm typecheck
pnpm check
pnpm --filter @repo/console-providers test
pnpm --filter @repo/console-providers build
```

---

## What We're NOT Doing

- Changing any type signatures, schemas, or runtime behavior
- Moving wire contracts to a separate `@repo/console-contracts` package
- Changing provider implementation files (`providers/*/`)
- Changing `registry.ts` location or exports
- Renaming exported symbols (every existing name stays)
- Breaking the `./display` entry point without migrating consumers first (Phase 3 migrates all, then removes)
- Changing `pnpm-workspace.yaml` or adding new packages

---

## Implementation Approach

Five phases, each independently verifiable. Phases 1–2 are pure internal refactors with no external API changes. Phases 3–4 add new entry points and migrate consumers. Phase 5 cleans up the barrel and removes legacy artifacts.

The guiding principle: **never leave a broken import state**. Each phase ends with `pnpm typecheck` passing across the full monorepo.

---

## Phase 1: Decompose `define.ts` → `provider/` folder

### Overview

Split `define.ts` into nine focused files under `src/provider/`. No external entry points change. All imports within the package are updated. `define.ts` becomes a re-export shim until all internal consumers are migrated, then is deleted.

Also absorb `types.ts` into `provider/primitives.ts` — it has no reason to exist as a top-level file once we have a `provider/` folder.

### Changes Required

#### 1. Create `src/provider/kinds.ts`
Extract lines 15–37 from `define.ts`:
- `providerKindSchema`, `ProviderKind`
- `authKindSchema`, `AuthKind`
- `categoryDefSchema`, `CategoryDef`
- `actionDefSchema`, `ActionDef`

No dependencies except `zod`.

#### 2. Create `src/provider/primitives.ts`
Move all of `src/types.ts` here:
- `transformContextSchema`, `TransformContext`
- `syncSchema`
- `oAuthTokensSchema`, `OAuthTokens`
- `baseProviderAccountInfoSchema`, `BaseProviderAccountInfo`
- `EdgeRule`
- `callbackResultSchema`, `CallbackResult`

No dependencies except `zod`. Replaces `types.ts` (which is deleted in this phase).

#### 3. Create `src/provider/events.ts`
Extract lines 40–88 from `define.ts`:
- `SimpleEventDef<S>`, `ActionEventDef<S, TActions>`, `EventDefinition<S, TActions>`
- `simpleEvent()`, `actionEvent()`

Imports:
- `PostTransformEvent` type from `../post-transform-event` (stays at root until Phase 4)
- `TransformContext` from `./primitives`

#### 4. Create `src/provider/webhook.ts`
Extract lines 90–280 from `define.ts`:
- `hmacSchemeSchema` (internal), `ed25519SchemeSchema` (internal), `signatureSchemeSchema`, `SignatureScheme`, `HmacScheme`, `Ed25519Scheme`
- `hmac()`, `ed25519()`, `VerifyFn`
- `WebhookDef<TConfig>`, `InboundWebhookDef<TConfig>`
- `webhookSetupStateSchema`, `WebhookSetupState`, `WebhookSetupDef<TConfig, TState>`, `ManagedWebhookDef<TConfig, TState>`

No runtime imports (crypto functions are in `runtime/verify/`; this file is type/schema only).

**Important**: `VerifyFn` stays here as a type. The actual `deriveVerifySignature` runtime implementation moves to `runtime/verify/index.ts` (Phase 2).

#### 5. Create `src/provider/auth.ts`
Extract lines 282–398 from `define.ts`:
- `OAuthDef<TConfig, TAccountInfo>`
- `ApiKeyDef<TConfig, TAccountInfo>`
- `AppTokenDef<TConfig, TAccountInfo>`
- `isAppTokenAuth()` type guard
- `AuthDef<TConfig, TAccountInfo>`

Imports:
- `OAuthTokens`, `BaseProviderAccountInfo`, `CallbackResult` from `./primitives`

#### 6. Create `src/provider/api.ts`
Extract lines 400–545 from `define.ts`:
- `connectionStatusSchema`, `ConnectionStatus`
- `HealthCheckDef<TConfig>`
- `runtimeConfigSchema`, `RuntimeConfig`
- `rateLimitSchema`, `RateLimit`
- `proxyExecuteRequestSchema`, `ProxyExecuteRequest`
- `proxyExecuteResponseSchema`, `ProxyExecuteResponse`
- `ApiEndpoint`, `ProviderApi`

No dependencies except `zod`.

#### 7. Create `src/provider/backfill.ts`
Extract lines 460–608 from `define.ts` (minus `backfillDepthSchema` + `BACKFILL_DEPTH_OPTIONS` which go to `client/options.ts` in Phase 3):
- `backfillWebhookEventSchema`, `BackfillWebhookEvent`
- `backfillContextSchema`, `BackfillContext`
- `BackfillEntityHandler`, `typedEntityHandler()`
- `BackfillDef`

**Note**: `BackfillDepth`, `backfillDepthSchema`, `BACKFILL_DEPTH_OPTIONS` are NOT extracted here — they move to `client/options.ts` in Phase 3 since they are pure static data with no server deps. During Phase 1, keep them in `define.ts` and re-export from here.

Imports:
- `BackfillDepth`, `backfillDepthSchema`, `BACKFILL_DEPTH_OPTIONS` re-exported from `./define` temporarily (removed in Phase 3)

#### 8. Create `src/provider/resource-picker.ts`
Extract lines 610–670 from `define.ts`:
- `ResourcePickerExecuteApiFn`
- `NormalizedInstallation`, `NormalizedResource`
- `InstallationMode`
- `ResourcePickerDef`

Imports:
- `ProxyExecuteRequest` from `./api`

#### 9. Create `src/provider/shape.ts`
Extract lines 672–912 from `define.ts`:
- `WebhookProvider<...>`, `ManagedProvider<...>`, `ApiProvider<...>`, `ProviderDefinition<...>`
- `isWebhookProvider()`, `isManagedProvider()`, `isApiProvider()`, `hasInboundWebhooks()`
- `ProviderWithInboundWebhooks` (internal)

Imports from: `./kinds`, `./events`, `./auth`, `./webhook`, `./api`, `./backfill`, `./resource-picker`, `./primitives`, `../client/display` (for `ProviderDisplayEntry`).

**Dependency note**: `shape.ts` imports `ProviderDisplayEntry` from `../client/display` — this requires Phase 3's `client/display.ts` to exist. **Strategy**: in Phase 1, temporarily import from `../../display` (the current file location), then update the import path in Phase 3 when `client/display.ts` is created.

#### 10. Create `src/provider/index.ts`
Re-exports everything from all the above files. This becomes the single import surface for `providers/*/` files replacing `../../define`:

```typescript
export * from "./kinds";
export * from "./primitives";
export * from "./events";
export * from "./webhook";
export * from "./auth";
export * from "./api";
export * from "./backfill";
export * from "./resource-picker";
export * from "./shape";
```

#### 11. Update intra-package imports
Update every file that `import ... from "./define"` or `import ... from "../../define"`:
- `src/registry.ts` → `import ... from "./provider/index"`
- `src/dispatch.ts` → `import ... from "./provider/index"`
- `src/validation.ts` → `import ... from "./provider/index"`
- `src/event-normalization.ts` → `import ... from "./provider/index"`
- `src/wire.ts` → `import ... from "./provider/index"` (temporary; moves in Phase 4)
- `src/backfill-contracts.ts` → `import ... from "./provider/index"` (temporary; moves in Phase 4)
- `src/gateway.ts` → stays, updates to `import ... from "./provider/index"` (temporary; moves in Phase 4)
- `src/post-transform-event.ts` → no changes (temporary; moves in Phase 4)
- `providers/github/index.ts` → `import ... from "../../provider/index"`
- `providers/linear/index.ts` → same
- `providers/sentry/index.ts` → same
- `providers/vercel/index.ts` → same
- `providers/apollo/index.ts` → same
- `providers/*/auth.ts` → import `OAuthTokens`, `CallbackResult`, `syncSchema` etc. from `../../provider/primitives`
- `providers/*/backfill.ts` → import `BackfillContext`, `typedEntityHandler` from `../../provider/backfill`
- `providers/*/api.ts` → import `ProviderApi`, `RateLimit` from `../../provider/api`

#### 12. Delete `src/types.ts`
After all imports from `./types` within the package are updated to `./provider/primitives`.

External consumers (relay, gateway, console) that import `EdgeRule` from `@repo/console-providers` continue to work unchanged — `index.ts` re-exports `EdgeRule` from `./provider/primitives` just as it previously did from `./types`.

#### 13. Update `src/index.ts` re-exports
Replace `export * from "./define"` with `export * from "./provider/index"`.
Replace `export ... from "./types"` with re-exports from `./provider/primitives`.

**`define.ts` is deleted** at the end of this phase. There is no shim — all internal imports are migrated as part of this phase.

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck` — zero errors across full monorepo
- [x] `pnpm --filter @repo/console-providers test` — all tests pass
- [x] `pnpm check` — zero lint errors
- [x] `pnpm --filter @repo/console-providers build` — builds both entry points cleanly
- [x] No `import.*from.*define` remaining in `src/`: `grep -r "from.*[\"'].*define[\"']" packages/console-providers/src/ --include="*.ts"` → empty

#### Manual Verification
- [ ] `define.ts` and `types.ts` do not exist in `src/`
- [ ] `src/provider/` folder contains exactly 9 source files + `index.ts`

---

## Phase 2: Extract `runtime/` + `factory/` folders

### Overview

Move the server-only file-level modules (`crypto.ts`, `jwt.ts`, `sanitize.ts`, `dispatch.ts`, `validation.ts`, `event-normalization.ts`) and the verification runtime (extracted from `define.ts` in Phase 1) into `src/runtime/`. Extract the three factory functions into `src/factory/`. These are file moves; no logic changes.

### Changes Required

#### 1. Create `src/runtime/crypto.ts`
Move `src/crypto.ts` content here. Update any import of `../../crypto` inside providers to `../../runtime/crypto`.

Affected files:
- `providers/github/api.ts` — if it imports `computeHmac` directly (check)
- `src/provider/webhook.ts` — doesn't import crypto (types only)

Note: `runtime/verify/hmac.ts` (created in step 4) imports from `../crypto`.

#### 2. Create `src/runtime/jwt.ts`
Move `src/jwt.ts` content here. Update `providers/github/index.ts` import: `../../jwt` → `../../runtime/jwt`.

#### 3. Create `src/runtime/sanitize.ts`
Move `src/sanitize.ts`. Update `src/runtime/validation.ts` import: `./sanitize`.

#### 4. Create `src/runtime/verify/` — extract from `define.ts` Phase 1 remainder
After Phase 1, `provider/webhook.ts` contains the type/schema half of what was in `define.ts`'s crypto block. The runtime half (`HMAC_ALGO_MAP`, `_deriveHmacVerify`, `_base64ToUint8Array`, `_deriveEd25519Verify`, `deriveVerifySignature`) currently remains in `define.ts` (now deleted — these were extracted but not yet placed).

**These are actually extracted in Phase 1 and placed directly into `runtime/verify/` during that phase.** This step is just ensuring the runtime verify folder is properly created:

- `src/runtime/verify/hmac.ts` — `HMAC_ALGO_MAP`, `_deriveHmacVerify`; imports `computeHmac`, `timingSafeEqual` from `../crypto`
- `src/runtime/verify/ed25519.ts` — `_base64ToUint8Array`, `_deriveEd25519Verify`; imports `@noble/ed25519`
- `src/runtime/verify/index.ts` — `deriveVerifySignature`; imports from `./hmac` and `./ed25519`; also exports `VerifyFn` type (or imports it from `../../provider/webhook`)

#### 5. Create `src/runtime/env.ts`
Extract `buildEnvGetter` from the now-deleted `define.ts` (Phase 1 deletes it; this extraction happens atomically in Phase 1's step). `factory/` imports from here.

#### 6. Create `src/runtime/dispatch.ts`
Move `src/dispatch.ts`. Updates import in `src/index.ts`.

#### 7. Create `src/runtime/validation.ts`
Move `src/validation.ts`. Updates import in `src/index.ts`.

#### 8. Create `src/runtime/event-norm.ts`
Move `src/event-normalization.ts`. Updates import in `src/index.ts`.

#### 9. Create `src/factory/webhook.ts`, `api.ts`, `managed.ts`, `index.ts`
Extract the three `define*Provider` factory functions. Each factory file imports from `../provider/index` and `../runtime/env`.

`src/factory/webhook.ts`:
```typescript
import { buildEnvGetter } from "../runtime/env";
import type { WebhookProvider } from "../provider/shape";
// ... defineWebhookProvider implementation
```

`src/factory/index.ts`:
```typescript
export { defineWebhookProvider } from "./webhook";
export { defineApiProvider } from "./api";
export { defineManagedProvider } from "./managed";
```

#### 10. Update `providers/*/index.ts` factory imports
All five provider `index.ts` files currently import `defineWebhookProvider` / `defineApiProvider` from `../../define` (now `../../provider/index` after Phase 1). Update to `../../factory/index`:

```typescript
// before (Phase 1 state)
import { defineWebhookProvider } from "../../provider/index";
// after (Phase 2)
import { defineWebhookProvider } from "../../factory/index";
```

#### 11. Delete moved source files
- Delete `src/crypto.ts` (moved to `src/runtime/crypto.ts`)
- Delete `src/jwt.ts` (moved to `src/runtime/jwt.ts`)
- Delete `src/sanitize.ts` (moved to `src/runtime/sanitize.ts`)
- Delete `src/dispatch.ts` (moved to `src/runtime/dispatch.ts`)
- Delete `src/validation.ts` (moved to `src/runtime/validation.ts`)
- Delete `src/event-normalization.ts` (moved to `src/runtime/event-norm.ts`)

#### 12. Update `src/index.ts` re-exports
Point all re-exports at new paths:
- `./crypto` → `./runtime/crypto`
- `./jwt` → `./runtime/jwt`
- `./sanitize` → `./runtime/sanitize`
- `./dispatch` → `./runtime/dispatch`
- `./validation` → `./runtime/validation`
- `./event-normalization` → `./runtime/event-norm`
- `./define` (factory functions) → `./factory/index`
- `./define` (verify) → `./runtime/verify/index`

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck` — zero errors
- [x] `pnpm --filter @repo/console-providers test` — all pass
- [x] `pnpm --filter @repo/console-providers build` — clean
- [x] No top-level `.ts` files remain in `src/` except: `client.ts` (not yet created), `contracts.ts` (not yet created), `index.ts`, `registry.ts`, `icon.ts`, `post-transform-event.ts`, `wire.ts`, `backfill-contracts.ts`, `gateway.ts`, `display.ts` (last five will move in Phases 3–4)

---

## Phase 3: `client/` folder + `./client` entry point

### Overview

Create `src/client/` with four source files, create `src/client.ts` entry point, add `./client` to `package.json` exports and `tsup.config.ts`, and migrate all consumers. Retire `./display` entry point.

The key additions beyond current `./display`: `PROVIDER_CATEGORIES`, `EVENT_LABELS`, `backfillDepthSchema`, `BACKFILL_DEPTH_OPTIONS` — static data currently trapped behind `server-only`.

### Changes Required

#### 1. Create `src/client/display.ts`
Move content of `src/display.ts` here verbatim. Update `src/registry.ts` import: `./display` → `./client/display`.

Update `src/provider/shape.ts` import: `../../display` (Phase 1 temporary) → `../client/display`.

#### 2. Create `src/client/options.ts`
Move `backfillDepthSchema`, `BackfillDepth`, `BACKFILL_DEPTH_OPTIONS` from `src/provider/backfill.ts` (where they were kept during Phase 1 as re-exports from the deleted define.ts):

```typescript
import { z } from "zod";

export const backfillDepthSchema = z.union([
  z.literal(1),
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);

export type BackfillDepth = z.infer<typeof backfillDepthSchema>;

export const BACKFILL_DEPTH_OPTIONS = [1, 7, 30, 90] as const satisfies readonly BackfillDepth[];
```

Update `src/provider/backfill.ts` to import from `../client/options` instead of inlining.

#### 3. Create `src/client/categories.ts`

`PROVIDER_CATEGORIES` is a compile-time static object. It must be **manually authored** from the data extracted in the research document (not derived at runtime from `PROVIDERS` to avoid server imports). This is the static extraction:

```typescript
import type { CategoryDef } from "../provider/kinds";
import type { ProviderSlug } from "./display";

export const PROVIDER_CATEGORIES: Record<ProviderSlug, Record<string, CategoryDef>> = {
  github: {
    pull_request: {
      label: "Pull Requests",
      description: "Capture PR opens, merges, closes, and reopens",
      type: "observation",
    },
    issues: {
      label: "Issues",
      description: "Capture issue opens, closes, and reopens",
      type: "observation",
    },
  },
  linear: {
    Issue: { label: "Issues", description: "Capture issue creates, updates, and deletes", type: "observation" },
    Comment: { label: "Comments", description: "Capture comment activity on issues", type: "observation" },
    IssueLabel: { label: "Issue Labels", description: "Capture issue label changes", type: "observation" },
    Project: { label: "Projects", description: "Capture project lifecycle events", type: "observation" },
    Cycle: { label: "Cycles", description: "Capture sprint/cycle lifecycle events", type: "observation" },
    ProjectUpdate: { label: "Project Updates", description: "Capture project status updates", type: "observation" },
  },
  sentry: {
    issue: { label: "Issues", description: "Capture issue state changes (created, resolved, assigned, ignored)", type: "observation" },
    error: { label: "Errors", description: "Capture individual error events", type: "observation" },
    comment: { label: "Comments", description: "Capture issue comment activity", type: "observation" },
    event_alert: { label: "Event Alerts", description: "Capture event alert rule triggers", type: "observation" },
    metric_alert: { label: "Metric Alerts", description: "Capture metric alert triggers and resolutions", type: "observation" },
  },
  vercel: {
    "deployment.created": { label: "Deployment Started", description: "Triggered when a deployment starts", type: "observation" },
    "deployment.succeeded": { label: "Deployment Succeeded", description: "Triggered when a deployment succeeds", type: "observation" },
    "deployment.ready": { label: "Deployment Ready", description: "Triggered when deployment traffic is live", type: "observation" },
    "deployment.error": { label: "Deployment Failed", description: "Triggered when a deployment errors", type: "observation" },
    "deployment.canceled": { label: "Deployment Canceled", description: "Triggered when a deployment is canceled", type: "observation" },
    "deployment.check-rerequested": { label: "Check Re-requested", description: "Triggered when a deployment check is re-requested", type: "observation" },
  },
  apollo: {},
} as const satisfies Record<ProviderSlug, Record<string, CategoryDef>>;
```

**Sync enforcement**: Add a test in `registry.test.ts` that deep-equals `PROVIDER_CATEGORIES[p]` against `PROVIDERS[p].categories` for each provider. This is the same pattern as `display-sync.test.ts`.

#### 4. Create `src/client/event-labels.ts`

Static flat map of every `provider:eventKey` → `label`. Manually authored from provider event definitions (these labels are literals in the provider files):

```typescript
import type { ProviderSlug } from "./display";

export type EventLabelKey = `${ProviderSlug}:${string}`;

export const EVENT_LABELS: Record<string, string> = {
  // GitHub
  "github:pull_request.opened": "PR Opened",
  "github:pull_request.closed": "PR Closed",
  "github:pull_request.merged": "PR Merged",
  "github:pull_request.reopened": "PR Reopened",
  "github:pull_request.ready-for-review": "Ready for Review",
  "github:issues.opened": "Issue Opened",
  "github:issues.closed": "Issue Closed",
  "github:issues.reopened": "Issue Reopened",
  // Linear
  "linear:Issue.created": "Issue Created",
  "linear:Issue.updated": "Issue Updated",
  "linear:Issue.deleted": "Issue Deleted",
  "linear:Comment.created": "Comment Added",
  "linear:Comment.updated": "Comment Updated",
  "linear:Comment.deleted": "Comment Deleted",
  "linear:IssueLabel.created": "Issue Label Created",
  "linear:IssueLabel.updated": "Issue Label Updated",
  "linear:IssueLabel.deleted": "Issue Label Deleted",
  "linear:Project.created": "Project Created",
  "linear:Project.updated": "Project Updated",
  "linear:Project.deleted": "Project Deleted",
  "linear:Cycle.created": "Cycle Created",
  "linear:Cycle.updated": "Cycle Updated",
  "linear:Cycle.deleted": "Cycle Deleted",
  "linear:ProjectUpdate.created": "Project Update Posted",
  // Sentry
  "sentry:issue.created": "Issue Created",
  "sentry:issue.resolved": "Issue Resolved",
  "sentry:issue.assigned": "Issue Assigned",
  "sentry:issue.ignored": "Issue Ignored",
  "sentry:issue.archived": "Issue Archived",
  "sentry:issue.unresolved": "Issue Unresolved",
  "sentry:error": "Errors",
  "sentry:event_alert": "Event Alerts",
  "sentry:metric_alert": "Metric Alerts",
  // Vercel
  "vercel:deployment.created": "Deployment Started",
  "vercel:deployment.succeeded": "Deployment Succeeded",
  "vercel:deployment.ready": "Deployment Ready",
  "vercel:deployment.error": "Deployment Failed",
  "vercel:deployment.canceled": "Deployment Canceled",
  "vercel:deployment.check-rerequested": "Deployment Check Re-requested",
} as const;
```

**Sync enforcement**: Add a test that every key in `EVENT_REGISTRY` exists in `EVENT_LABELS` and the labels match.

#### 5. Create `src/client.ts` entry point

```typescript
export * from "./client/display";
export * from "./client/categories";
export * from "./client/event-labels";
export * from "./client/options";
```

#### 6. Update `package.json` exports

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "default": "./dist/client.js"
    },
    "./display": {
      "types": "./dist/client.d.ts",
      "default": "./dist/client.js"
    }
  }
}
```

The `./display` entry point becomes a forward alias to `./client` (same build output) for zero-migration-cost compatibility during the transition window. It is removed in Phase 5.

#### 7. Update `tsup.config.ts`

Add `"src/client.ts"` to the `entry` array.

#### 8. Migrate all client component imports

Update every `"use client"` component and browser-facing file:

**`@repo/console-providers/display` → `@repo/console-providers/client`:**
- `apps/console/src/hooks/use-oauth-popup.ts`
- `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/sources/_components/sources-list.tsx`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/use-event-filters.ts`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/sources-section.tsx`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/link-sources-button.tsx`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/page.tsx`
- `apps/console/src/components/search-constants.ts`
- `apps/console/src/lib/provider-icon.tsx`

**Fix wrong-entry imports (main barrel → `./client`):**
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/page.tsx` — `PROVIDER_DISPLAY` from main → `./client`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/page.tsx` — `PROVIDER_DISPLAY`, `ProviderDisplayEntry` from main → `./client`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/sources-section-loading.tsx` — `PROVIDER_DISPLAY` from main → `./client`

**Fix `debug-panel-content.tsx` client component using server-only main barrel:**
- Replace `EVENT_REGISTRY` from main barrel → `EVENT_LABELS` from `./client`
- Replace `PROVIDERS[p].categories` from main barrel → `PROVIDER_CATEGORIES` from `./client`
- Replace `EVENT_REGISTRY` label lookup with `EVENT_LABELS[key]` lookup

**Fix `event-row.tsx`:**
- Replace `EVENT_REGISTRY` from main barrel → `EVENT_LABELS` from `./client`

**Fix `source-settings-form.tsx`:**
- Replace `BACKFILL_DEPTH_OPTIONS` from main barrel → `./client`
- Replace `PROVIDERS[p].categories` from main barrel → `PROVIDER_CATEGORIES` from `./client`
- `CategoryDef` type → from `./client` (re-exported from `client/categories.ts`)
- `SourceType` type — stays on main barrel (it's `ProviderSlug` alias, already in `./client`)

**Fix `provider-source-item.tsx`:**
- `NormalizedResource` type — keep from main barrel (it's a server type, type-only import is fine)

#### 9. Delete `src/display.ts`
The content has moved to `src/client/display.ts`. The `./display` package export now maps to `dist/client.js`.

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck` — zero errors
- [x] `pnpm --filter @repo/console-providers test` — all pass (including new sync tests)
- [x] `pnpm check` — zero lint errors
- [x] `pnpm --filter @repo/console-providers build` — 3 entry points built (`dist/index.js`, `dist/client.js`, `dist/display.js` → same as `dist/client.js`)
- [x] `grep -r "from.*[\"']@repo/console-providers[\"']" apps/console/src --include="*.tsx" --include="*.ts" -l` — no `"use client"` files in results (confirm with `grep -l '"use client"'`)

#### Manual Verification
- [ ] `debug-panel-content.tsx` uses only `@repo/console-providers/client` — no main barrel
- [ ] `src/display.ts` does not exist at root of `src/`
- [ ] Category display and event labels render correctly in the UI

---

## Phase 4: `contracts/` folder + `./contracts` entry point

### Overview

Create `src/contracts/` with four files housing the cross-service Zod schemas. Fix the transitive dependency bugs in `wire.ts` and `backfill-contracts.ts`. Add `./contracts` to package exports. Migrate all service consumers.

### Changes Required

#### 1. Create `src/contracts/event.ts`
Move `src/post-transform-event.ts` content here verbatim:
- `entityRefSchema`, `EntityRef`
- `entityRelationSchema`, `EntityRelation`
- `postTransformEventSchema`, `PostTransformEvent`

No imports except `zod`.

Update `src/provider/events.ts` import: `../post-transform-event` → `../contracts/event`.

#### 2. Create `src/contracts/gateway.ts`
Move `src/gateway.ts` content here verbatim:
- `gatewayConnectionSchema`, `GatewayConnection`
- `gatewayTokenResultSchema`, `GatewayTokenResult`
- `proxyEndpointsResponseSchema`, `ProxyEndpointsResponse`
- `gwInstallationBackfillConfigSchema`, `GwInstallationBackfillConfig`
- `backfillRunRecord`, `backfillRunReadRecord`, `BackfillRunRecord`, `BackfillRunReadRecord`
- `BACKFILL_TERMINAL_STATUSES`

No imports except `zod`.

#### 3. Create `src/contracts/wire.ts`
Fix the transitive dependency bug. Move `src/wire.ts` content here with import corrected:

```typescript
// BEFORE (broken — pulls in all providers via registry)
import { sourceTypeSchema } from "./registry";

// AFTER (fixed — direct import from client/)
import { providerSlugSchema } from "../client/display";
```

Use `providerSlugSchema` directly wherever `sourceTypeSchema` was used in schemas. The exported names remain the same.

#### 4. Create `src/contracts/backfill.ts`
Fix the transitive dependency bug. Move `src/backfill-contracts.ts` content here with imports corrected:

```typescript
// BEFORE (broken — pulls in all providers + @t3-oss/env-core)
import { backfillDepthSchema } from "./define";
import { sourceTypeSchema } from "./registry";

// AFTER (fixed — direct imports from client/)
import { backfillDepthSchema } from "../client/options";
import { providerSlugSchema } from "../client/display";
```

#### 5. Create `src/contracts.ts` entry point

```typescript
export * from "./contracts/event";
export * from "./contracts/wire";
export * from "./contracts/gateway";
export * from "./contracts/backfill";
```

#### 6. Update `package.json` exports

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./client": { "types": "./dist/client.d.ts", "default": "./dist/client.js" },
    "./display": { "types": "./dist/client.d.ts", "default": "./dist/client.js" },
    "./contracts": { "types": "./dist/contracts.d.ts", "default": "./dist/contracts.js" }
  }
}
```

#### 7. Update `tsup.config.ts`

Add `"src/contracts.ts"` to the `entry` array.

#### 8. Delete moved source files
- Delete `src/post-transform-event.ts`
- Delete `src/gateway.ts`
- Delete `src/wire.ts`
- Delete `src/backfill-contracts.ts`

#### 9. Update `src/index.ts` re-exports
Replace removed file re-exports with re-exports from `./contracts/*`:

```typescript
export * from "./contracts/event";
export * from "./contracts/wire";
export * from "./contracts/gateway";
export * from "./contracts/backfill";
```

Server consumers using the main barrel continue to get these exports unchanged.

#### 10. Migrate service consumers to `./contracts`

**relay** (`apps/relay/src/`):
- `routes/webhooks.ts` — `WebhookEnvelope`, `WebhookReceiptPayload` → `@repo/console-providers/contracts`
- `routes/workflows.ts` — `WebhookReceiptPayload` → `@repo/console-providers/contracts`
- `middleware/webhook.ts` — `ServiceAuthWebhookBody`, `serviceAuthWebhookBodySchema` → `@repo/console-providers/contracts`
- `lib/replay.ts` — `WebhookReceiptPayload` → `@repo/console-providers/contracts`

**gateway** (`apps/gateway/src/`):
- `routes/connections.ts` — `GwInstallationBackfillConfig`, `backfillRunRecord`, `BACKFILL_TERMINAL_STATUSES` → `@repo/console-providers/contracts`

**packages/gateway-service-clients** (`packages/gateway-service-clients/src/`):
- `gateway.ts` — `GatewayConnection`, `GatewayTokenResult`, `ProxyEndpointsResponse`, `BackfillRunRecord`, `BackfillRunReadRecord`, `TypedProxyRequest`, `ResponseDataFor` → split: contract types from `@repo/console-providers/contracts`, proxy types from `@repo/console-providers`
- `backfill.ts` — `BackfillEstimatePayload`, `BackfillTriggerPayload` → `@repo/console-providers/contracts`

**console API** (`api/console/src/`):
- `inngest/client/client.ts` — `postTransformEventSchema` → `@repo/console-providers/contracts`
- `inngest/workflow/neural/event-store.ts` — `PostTransformEvent` type → `@repo/console-providers/contracts`
- `inngest/workflow/neural/scoring.ts` — `PostTransformEvent` type → `@repo/console-providers/contracts`

**apps/console** (`apps/console/src/`):
- `app/api/gateway/ingress/route.ts` — `WebhookEnvelope` → `@repo/console-providers/contracts`
- `app/api/gateway/ingress/_lib/transform.ts` — `PostTransformEvent`, `WebhookEnvelope` → `@repo/console-providers/contracts`
- `app/api/gateway/ingress/_lib/notify.ts` — `PostTransformEvent` → `@repo/console-providers/contracts`
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-detail.tsx` — `PostTransformEvent` type → `@repo/console-providers/contracts`
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/events-table.tsx` — `PostTransformEvent` type → `@repo/console-providers/contracts`
- `app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-row.tsx` — `PostTransformEvent` type → `@repo/console-providers/contracts`

**db** (`db/console/src/`):
- `schema/tables/workspace-events.ts` — `EntityRelation` → `@repo/console-providers/contracts`
- `schema/tables/workspace-ingest-logs.ts` — `PostTransformEvent` → `@repo/console-providers/contracts`
- `schema/tables/gateway-installations.ts` — `GwInstallationBackfillConfig` → `@repo/console-providers/contracts`

**packages/console-upstash-realtime**:
- `src/index.ts` — `postTransformEventSchema` → `@repo/console-providers/contracts`

**packages/console-test-data**:
- `src/loader/index.ts` — `PostTransformEvent` → `@repo/console-providers/contracts`
- `src/loader/transform.ts` — `PostTransformEvent` → `@repo/console-providers/contracts`
- `src/cli/verify-datasets.ts` — `PostTransformEvent` → `@repo/console-providers/contracts`

**backfill** (`apps/backfill/src/`):
- `routes/estimate.ts` — `BackfillContext` from main barrel (this is a provider type, keep on main)
- `routes/trigger.ts` — `backfillTriggerPayload` → `@repo/console-providers/contracts`
- `inngest/client.ts` — `backfillDepthSchema`, `backfillTriggerPayload` → `@repo/console-providers/contracts` for payload; `backfillDepthSchema` from `@repo/console-providers/client`

**packages/console-validation**:
- `src/schemas/workflow-io.ts` — `sourceTypeSchema` → `@repo/console-providers/client` (it's `providerSlugSchema`)

**Note on `BackfillContext`**: This type lives in `src/provider/backfill.ts` (server-only). Backfill service imports it from main barrel. This is correct — it's a server-side runtime type, not a contract schema. Leave it on the main barrel.

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck` — zero errors
- [x] `pnpm --filter @repo/console-providers test` — all pass
- [x] `pnpm check` — zero lint errors
- [x] `pnpm --filter @repo/console-providers build` — 4 entry points built cleanly
- [x] Verify no transitive server deps in contracts: `node -e "import('@repo/console-providers/contracts')"` from a non-server environment (or check that the compiled `dist/contracts.js` has no `server-only` imports)
- [x] `grep -r "from.*[\"']@repo/console-providers[\"']" apps/relay/src packages/gateway-service-clients/src --include="*.ts"` → only `getProvider`, `isWebhookProvider`, `PROVIDERS`, crypto utils remain on main barrel

#### Manual Verification
- [ ] `src/post-transform-event.ts`, `src/gateway.ts`, `src/wire.ts`, `src/backfill-contracts.ts` do not exist at `src/` root

---

## Phase 5: Root barrel cleanup + retire `./display`

### Overview

Reorganize `src/index.ts` into clearly labelled sections. Remove the `./display` backward-compat shim. Clean up any remaining legacy patterns.

### Changes Required

#### 1. Reorganize `src/index.ts`

Replace the current ~400-line flat re-export list with section-grouped exports:

```typescript
import "server-only";

// ── Provider type system ──────────────────────────────────────────────────────
export * from "./provider/index";

// ── Factory functions ─────────────────────────────────────────────────────────
export * from "./factory/index";

// ── Runtime utilities ─────────────────────────────────────────────────────────
export { deriveVerifySignature } from "./runtime/verify/index";
export { computeHmac, sha256Hex, timingSafeEqual, timingSafeStringEqual } from "./runtime/crypto";
export { createRS256JWT } from "./runtime/jwt";
export { sanitizePostTransformEvent } from "./runtime/sanitize";  // (if exists)
export { transformWebhookPayload } from "./runtime/dispatch";
export { deriveObservationType, getBaseEventType } from "./runtime/event-norm";

// ── Cross-service contracts (also available via @repo/console-providers/contracts) ──
export * from "./contracts/event";
export * from "./contracts/wire";
export * from "./contracts/gateway";
export * from "./contracts/backfill";

// ── Client-safe data (also available via @repo/console-providers/client) ──────
export { PROVIDER_DISPLAY, providerSlugSchema } from "./client/display";
export type { ProviderSlug, ProviderDisplayEntry } from "./client/display";

// ── Registry ──────────────────────────────────────────────────────────────────
export * from "./registry";

// ── Provider implementations (auth schemas, webhook schemas) ──────────────────
export * from "./providers/github/auth";
export * from "./providers/github/schemas";
export { transformGitHubPullRequest, transformGitHubIssue } from "./providers/github/transformers";
// ... (linear, sentry, vercel, apollo — same pattern)
```

#### 2. Remove `./display` from `package.json` exports

After all consumers are migrated to `./client` in Phase 3, the backward compat shim `"./display"` is removed:

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./client": { "types": "./dist/client.d.ts", "default": "./dist/client.js" },
    "./contracts": { "types": "./dist/contracts.d.ts", "default": "./dist/contracts.js" }
  }
}
```

#### 3. Remove `src/client.ts` and `src/contracts.ts` type duplication from barrel

The root barrel re-exports contracts and client-safe data to maintain backward compatibility for server consumers that currently import everything from `"@repo/console-providers"`. This is intentional. Server components that import `PostTransformEvent` from `@repo/console-providers` continue to work.

#### 4. Add `src/provider/categories-sync.test.ts`

Compile-time + runtime sync test ensuring `PROVIDER_CATEGORIES` matches `PROVIDERS[p].categories`:

```typescript
import { PROVIDERS } from "../../registry";
import { PROVIDER_CATEGORIES } from "../../client/categories";

describe("PROVIDER_CATEGORIES sync", () => {
  for (const [slug, provider] of Object.entries(PROVIDERS)) {
    it(`${slug}: PROVIDER_CATEGORIES matches PROVIDERS[${slug}].categories`, () => {
      expect(PROVIDER_CATEGORIES[slug as keyof typeof PROVIDER_CATEGORIES])
        .toEqual(provider.categories);
    });
  }
});
```

#### 5. Add `src/client/event-labels-sync.test.ts`

```typescript
import { EVENT_REGISTRY } from "../../registry";
import { EVENT_LABELS } from "./event-labels";

describe("EVENT_LABELS sync", () => {
  it("every EVENT_REGISTRY key exists in EVENT_LABELS", () => {
    for (const key of Object.keys(EVENT_REGISTRY)) {
      expect(EVENT_LABELS).toHaveProperty(key);
    }
  });

  it("labels match", () => {
    for (const [key, entry] of Object.entries(EVENT_REGISTRY)) {
      expect(EVENT_LABELS[key]).toBe(entry.label);
    }
  });
});
```

### Success Criteria

#### Automated Verification
- [x] `pnpm typecheck` — zero errors across full monorepo
- [x] `pnpm check` — zero lint errors
- [x] `pnpm --filter @repo/console-providers test` — all pass including sync tests
- [x] `pnpm --filter @repo/console-providers build` — exactly 3 outputs: `dist/index.js`, `dist/client.js`, `dist/contracts.js`
- [x] `grep -r "console-providers/display" . --include="*.ts" --include="*.tsx" -r` → zero results (all consumers on `./client`)
- [x] No `.ts` files remain at `src/` root except: `index.ts`, `registry.ts`, `icon.ts`, `client.ts`, `contracts.ts`

#### Manual Verification
- [ ] New developer can open `packages/console-providers/src/` and immediately understand the folder purpose from names
- [ ] A new provider can be added by touching only: `client/display.ts` (add slug + display), `client/categories.ts`, `client/event-labels.ts`, `providers/<new>/`, `registry.ts` (add to PROVIDERS)
- [ ] Zero TypeScript errors after adding a new provider stub

---

## Testing Strategy

### Sync Tests (new)
- `provider/categories-sync.test.ts` — `PROVIDER_CATEGORIES` vs `PROVIDERS[p].categories`
- `client/event-labels-sync.test.ts` — `EVENT_LABELS` vs `EVENT_REGISTRY`

### Existing Tests (must remain green)
- `providers/github/index.test.ts` — auth, webhook, processCallback
- `providers/linear/index.test.ts` — same
- `providers/sentry/index.test.ts` — same
- `providers/vercel/index.test.ts` — same
- `crypto.test.ts` (moved to `runtime/crypto.test.ts`)
- `registry.test.ts`

---

## Migration Notes

- The `./display` entry point remains active (as a forward alias to `./client`) through Phase 5. No consumer breaks during Phases 3–4.
- The main barrel (`.`) continues to re-export all contract types and client-safe data. Server consumers that import `PostTransformEvent` from `@repo/console-providers` do not need to change unless they want to.
- The only breaking change is the removal of `./display` in Phase 5, which is only reached after all consumers are migrated.

---

## References

- Entry-point research: `thoughts/shared/research/2026-03-18-console-providers-entry-point-layers.md`
- Provider architecture plan: `thoughts/shared/plans/2026-03-18-provider-architecture-redesign.md`
- Type-cast elimination: `thoughts/shared/plans/2026-03-18-type-cast-elimination.md`
