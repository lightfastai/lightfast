---
date: 2026-03-18T00:00:00Z
researcher: claude
git_commit: 1581d9e1aed547ec49dd02499c9978a7ea8206b4
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "Provider Architecture — Future Innovations: Payload Pipeline, Relay Factory, Category/Backfill Unification, Telemetry"
tags: [architecture, providers, future, typed-payload, relay-factory, backfill, telemetry, zod-first]
status: draft
last_updated: 2026-03-18
---

# Provider Architecture — Future Innovations

**Date**: 2026-03-18
**Git Commit**: `1581d9e1aed547ec49dd02499c9978a7ea8206b4`
**Branch**: `refactor/define-ts-provider-redesign`

---

## Scope

This document captures the four deferred innovations from the synthesis document (`2026-03-18-provider-architecture-synthesis.md`). They were deferred because each requires significant design work or runtime infrastructure that is orthogonal to the 10 core changes. None of them block the synthesis changes from being implemented.

**What is already decided** (do not re-design):
- 3-tier model: `WebhookProvider | ManagedProvider | ApiProvider`
- `AppTokenDef` (Change 1)
- `lifecycle` optional (Change 2)
- `SignatureScheme` as Zod-first data (Change 3)
- `ManagedProvider` + `WebhookSetupDef` (Change 4)
- Display consolidation (Change 5)
- `gateway.ts` split into `wire.ts`, `gateway.ts`, `backfill-contracts.ts` (Change 6)
- Registry 1-touch (Change 7)
- Relay config threading (Change 8)
- `ClientShape` + `PROVIDER_CLIENT_REGISTRY` (Change 9)
- Connection lifecycle FSM (Change 10)

**What this document designs**:
- Innovation 2: Category ↔ BackfillEntityType Unification
- Innovation 3: Typed Payload Pipeline — End-to-End
- Innovation 4: Relay Auto-Registration — Registry as Router
- Innovation 7: Provider Telemetry Schema — Observable-First Design

---

## Live Codebase Baseline (as of this research)

### Current `CategoryDef` and `BackfillDef` structures

`packages/console-providers/src/define.ts:13-18`:
```typescript
export const categoryDefSchema = z.object({
  description: z.string(),
  label: z.string(),
  type: z.enum(["observation", "sync+observation"]),
});
export type CategoryDef = z.infer<typeof categoryDefSchema>;
```

`packages/console-providers/src/define.ts:357-362`:
```typescript
export interface BackfillDef {
  readonly defaultEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
  readonly supportedEntityTypes: readonly string[];
}
```

### The category/backfill key correspondence in practice

**GitHub** (`providers/github/index.ts:80-91` + `providers/github/backfill.ts:100-103`):
- `categories` keys: `"pull_request"`, `"issues"` — both `type: "observation"`
- `backfill.entityTypes` keys: `"pull_request"`, `"issue"` (note: **`issue`** not `issues`)
- `backfill.supportedEntityTypes`: `["pull_request", "issue"]`
- **Key mismatch**: category uses `"issues"`, backfill uses `"issue"` — these are NOT the same string

**Linear** (`providers/linear/index.ts:177-208` + `providers/linear/backfill.ts:381-384`):
- `categories` keys: `"Issue"`, `"Comment"`, `"IssueLabel"`, `"Project"`, `"Cycle"`, `"ProjectUpdate"` — all `type: "observation"`
- `backfill.entityTypes` keys: `"Issue"`, `"Comment"`, `"Project"`
- `backfill.supportedEntityTypes`: `["Issue", "Comment", "Project"]`
- **Structural observation**: `IssueLabel`, `Cycle`, `ProjectUpdate` are in `categories` but NOT in `backfill.entityTypes`. The categories are not a superset of backfill entity types — the relationship is many-from-many.

**Sentry** (`providers/sentry/index.ts:105-132` + `providers/sentry/backfill.ts:135-137`):
- `categories` keys: `"issue"`, `"error"`, `"comment"`, `"event_alert"`, `"metric_alert"` — all `type: "observation"`
- `backfill.entityTypes` keys: `"issue"`, `"error"`
- `backfill.supportedEntityTypes`: `["issue", "error"]`
- **Structural observation**: `comment`, `event_alert`, `metric_alert` are in `categories` but NOT in `backfill.entityTypes`

**Critical finding**: No current provider uses `type: "sync+observation"` in their category definitions. Every category is `type: "observation"`. The `"sync+observation"` type exists in `categoryDefSchema` but is unused in all 5 live providers.

### Current wire schemas (payload fields)

`packages/console-providers/src/gateway.ts:15-26` — `serviceAuthWebhookBodySchema`:
```typescript
payload: z.unknown(),
```

`packages/console-providers/src/gateway.ts:32-41` — `webhookReceiptPayloadSchema`:
```typescript
payload: z.unknown(),
```

`packages/console-providers/src/gateway.ts:48-65` — `webhookEnvelopeSchema`:
```typescript
payload: z.unknown(),
```

All three use `z.unknown()`. The first payload cast happens in `dispatch.ts:30-31`:
```typescript
const parsed = eventDef.schema.parse(payload);
return eventDef.transform(parsed, context, eventType);
```
The schema parse is the only type-narrowing step in the pipeline. There are also raw casts in provider extraction functions: `extractResourceId` at `providers/github/index.ts:139`, `providers/linear/index.ts:380`, etc.

### Current relay route registration

`apps/relay/src/app.ts:65`:
```typescript
app.route("/api/webhooks", webhooks);
```

`apps/relay/src/routes/webhooks.ts:44-52` — single static route:
```typescript
webhooks.post(
  "/:provider",
  providerGuard,
  serviceAuthDetect,
  serviceAuthBodyValidator,
  webhookHeaderGuard,
  rawBodyCapture,
  signatureVerify,
  payloadParseAndExtract,
  async (c) => { ... }
);
```

`apps/relay/src/middleware/webhook.ts:87-108` — `providerGuard`:
```typescript
const providerDef = getProvider(rawProvider);
if (!providerDef) return c.json({ error: "unknown_provider" }, 400);
if (!isWebhookProvider(providerDef)) return c.json({ error: "unknown_provider" }, 400);
// ...
c.set("providerDef", providerDef as WebhookProvider);
```

The relay uses a single wildcard `/:provider` route. New providers auto-register in this route — the `providerGuard` does the filtering. The middleware stack is static and uniform for all providers.

### Current logging patterns in provider code

No structured telemetry contract exists. Providers use:
- `console.error` directly in `providers/sentry/index.ts:58`
- Ad-hoc `log.warn` / `log.error` calls in relay middleware
- No typed emission from inside provider functions themselves
- `correlationId` exists in `webhookReceiptPayloadSchema` and `webhookEnvelopeSchema` but is never propagated into provider function calls

---

## Innovation 2 — Category ↔ BackfillEntityType Unification

### Current state analysis

The intuition from the innovation description — that `"sync+observation"` categories "are" backfill entity types — is sound in theory but incorrect in practice with the live codebase. The critical finding:

1. **No current provider uses `type: "sync+observation"`** — every category in GitHub, Linear, Sentry, Vercel, and Apollo uses `type: "observation"`.

2. **The key spaces don't align**: GitHub's category key `"issues"` maps to backfill entity key `"issue"`. Linear's `"Issue"`, `"Comment"`, `"Project"` categories have backfill handlers, but `"IssueLabel"`, `"Cycle"`, `"ProjectUpdate"` do not.

3. **Backfill entity keys are a strict subset of category keys in some providers (Sentry: `issue`, `error` backfill ⊂ 5 categories), but use different keys in others (GitHub: `issue` ≠ `issues`).**

The deferred innovation would work if the design makes category keys authoritative for backfill entity registration — but this requires either (a) renaming GitHub's `"issues"` category to `"issue"`, or (b) allowing a separate `backfillKey` override on the category definition.

### Proposed design

The unification works by introducing a discriminated variant `SyncObservationCategoryDef` that carries a `backfill: BackfillEntityHandler` field directly. `categoryDefSchema` becomes a Zod discriminated union. The `BackfillDef.entityTypes` record is derived from categories at registry build time, not declared manually.

```typescript
// packages/console-providers/src/define.ts

// ── Updated CategoryDef (Zod-first) ──────────────────────────────────────────

/**
 * Observation-only category — no backfill support.
 * Used for event types where historical import is not possible or not needed
 * (e.g., metric alerts, lifecycle events from SaaS providers).
 */
export const observationCategoryDefSchema = z.object({
  description: z.string(),
  label: z.string(),
  type: z.literal("observation"),
});
export type ObservationCategoryDef = z.infer<typeof observationCategoryDefSchema>;

/**
 * Sync+observation category — supports both live webhook delivery AND backfill.
 * Carries a BackfillEntityHandler inline. The handler is used directly by the
 * backfill orchestrator — no separate BackfillDef.entityTypes registration needed.
 *
 * IMPORTANT: Contains a function (BackfillEntityHandler). Therefore:
 *   - The `type: "sync+observation"` Zod discriminant validates at runtime.
 *   - The `backfill` handler is a TypeScript interface — NOT a Zod schema.
 *   - At provider load time, call categoryDefSchema.safeParse(c) to validate
 *     the data fields; the handler is validated structurally by TypeScript.
 */
export interface SyncObservationCategoryDef {
  readonly description: string;
  readonly label: string;
  readonly type: "sync+observation";
  /**
   * Backfill handler for this entity type.
   * Required when type === "sync+observation".
   * Provider authors define categories once — the handler lives here.
   */
  readonly backfill: BackfillEntityHandler;
}

/**
 * Discriminated union of category definitions.
 * Switches on `type`.
 */
export type CategoryDef = ObservationCategoryDef | SyncObservationCategoryDef;

// Type guard:
export function isSyncObservationCategory(
  c: CategoryDef
): c is SyncObservationCategoryDef {
  return c.type === "sync+observation";
}
```

The `BackfillDef` interface becomes simpler — `entityTypes` is derived, not declared:

```typescript
/**
 * Backfill definition — the entityTypes record is now DERIVED from provider categories.
 * Provider authors only declare defaultEntityTypes (which category keys to enable by default)
 * and the platform derives supportedEntityTypes from the categories that have type === "sync+observation".
 *
 * MIGRATION NOTE: entityTypes is removed from this interface. It is derived by
 * deriveBackfillEntityTypes() at registry initialization time.
 */
export interface BackfillDef {
  /**
   * Which entity type keys to backfill by default when a new connection is established.
   * Must be a subset of the provider's sync+observation category keys.
   */
  readonly defaultEntityTypes: readonly string[];
  // entityTypes and supportedEntityTypes are DERIVED — no longer declared here
}
```

Platform utility (new export in `define.ts`):

```typescript
/**
 * Derive the entityTypes record from provider categories.
 * Call at registry initialization — not at runtime per-request.
 *
 * @param categories - The provider's categories record
 * @returns Record<string, BackfillEntityHandler> — only sync+observation categories
 */
export function deriveBackfillEntityTypes(
  categories: Record<string, CategoryDef>
): Record<string, BackfillEntityHandler> {
  return Object.fromEntries(
    Object.entries(categories)
      .filter((entry): entry is [string, SyncObservationCategoryDef] =>
        isSyncObservationCategory(entry[1])
      )
      .map(([key, c]) => [key, c.backfill])
  );
}

/**
 * Derive the supportedEntityTypes array from provider categories.
 * Returns keys of all sync+observation categories.
 */
export function deriveSupportedEntityTypes(
  categories: Record<string, CategoryDef>
): readonly string[] {
  return Object.entries(categories)
    .filter(([, c]) => isSyncObservationCategory(c))
    .map(([key]) => key);
}
```

Runtime `BackfillDef` shape used by the backfill orchestrator (internal — not part of the provider contract):

```typescript
/**
 * Runtime backfill config — fully resolved, used by backfill service.
 * Derived by resolveDerived BackfillConfig(provider) at orchestrator startup.
 * Provider authors never construct this directly.
 */
export interface ResolvedBackfillConfig {
  readonly defaultEntityTypes: readonly string[];
  readonly supportedEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
}

export function resolveBackfillConfig(
  def: BackfillDef,
  categories: Record<string, CategoryDef>
): ResolvedBackfillConfig {
  const entityTypes = deriveBackfillEntityTypes(categories);
  return {
    defaultEntityTypes: def.defaultEntityTypes,
    supportedEntityTypes: Object.keys(entityTypes),
    entityTypes,
  };
}
```

### Provider migration — GitHub example

The current GitHub provider has a key mismatch (`"issues"` category vs `"issue"` entity type). The migration resolves this by renaming:

```typescript
// BEFORE (github/index.ts):
categories: {
  pull_request: { label: "Pull Requests", description: "...", type: "observation" },
  issues:       { label: "Issues",        description: "...", type: "observation" },
},
backfill: githubBackfill,  // separate file — entityTypes: { pull_request, issue }

// AFTER (github/index.ts) — categories carry their handlers:
categories: {
  pull_request: {
    label: "Pull Requests",
    description: "Capture PR opens, merges, closes, and reopens",
    type: "sync+observation",  // upgraded from "observation"
    backfill: typedEntityHandler<{ page: number }>({
      endpointId: "list-pull-requests",
      buildRequest: githubPRBuildRequest,
      processResponse: githubPRProcessResponse,
    }),
  },
  issues: {  // key kept as "issues" for display consistency — entity type is now "issues"
    label: "Issues",
    description: "Capture issue opens, closes, and reopens",
    type: "sync+observation",
    backfill: typedEntityHandler<{ page: number }>({
      endpointId: "list-issues",
      buildRequest: githubIssueBuildRequest,
      processResponse: githubIssueProcessResponse,
    }),
  },
},
// backfill.ts file contents can be inlined or kept as module-level functions

backfill: {
  defaultEntityTypes: ["pull_request", "issues"],
  // supportedEntityTypes is now derived: ["pull_request", "issues"]
  // entityTypes is now derived from categories
},
```

**The key rename**: GitHub's backfill previously used `"issue"` (singular) as the entity type key, but the category was `"issues"` (plural). Under unification, the entity type key becomes the category key. This means `backfillTriggerPayload.entityTypes` array values change from `"issue"` to `"issues"` for GitHub. Any persisted `gwInstallationBackfillConfig.entityTypes` data that contains `"issue"` needs a data migration.

### Linear example

```typescript
// BEFORE (linear/index.ts): 6 categories all "observation", 3 separate backfill entity types

// AFTER:
categories: {
  Issue: {
    label: "Issues",
    description: "Capture issue creates, updates, and deletes",
    type: "sync+observation",
    backfill: typedEntityHandler<string>({ ... }), // existing logic from backfill.ts
  },
  Comment: {
    label: "Comments",
    description: "Capture comment activity on issues",
    type: "sync+observation",
    backfill: typedEntityHandler<string>({ ... }),
  },
  IssueLabel: {
    label: "Issue Labels",
    description: "Capture issue label changes",
    type: "observation",  // no backfill — stays observation
  },
  Project: {
    label: "Projects",
    description: "Capture project lifecycle events",
    type: "sync+observation",
    backfill: typedEntityHandler<string>({ ... }),
  },
  Cycle: {
    label: "Cycles",
    description: "Capture sprint/cycle lifecycle events",
    type: "observation",  // no backfill — stays observation
  },
  ProjectUpdate: {
    label: "Project Updates",
    description: "Capture project status updates",
    type: "observation",  // no backfill — stays observation
  },
},
backfill: {
  defaultEntityTypes: ["Issue", "Comment", "Project"],
},
```

### What changes in which files

| File | Change |
|---|---|
| `packages/console-providers/src/define.ts` | Add `SyncObservationCategoryDef` interface, update `CategoryDef` type, update `BackfillDef` interface, add `deriveBackfillEntityTypes`, `deriveSupportedEntityTypes`, `resolveBackfillConfig` |
| `packages/console-providers/src/providers/github/backfill.ts` | Dissolve — inline handler functions into `index.ts` or extract to separate function modules |
| `packages/console-providers/src/providers/github/index.ts` | Upgrade `pull_request` and `issues` categories to `sync+observation`, inline backfill handlers |
| `packages/console-providers/src/providers/linear/backfill.ts` | Dissolve — inline `Issue`, `Comment`, `Project` handlers |
| `packages/console-providers/src/providers/linear/index.ts` | Upgrade `Issue`, `Comment`, `Project` to `sync+observation` |
| `packages/console-providers/src/providers/sentry/backfill.ts` | Dissolve — inline `issue`, `error` handlers |
| `packages/console-providers/src/providers/sentry/index.ts` | Upgrade `issue`, `error` to `sync+observation` |
| `packages/console-providers/src/providers/vercel/backfill.ts` | Dissolve — inline handlers |
| `packages/console-providers/src/providers/vercel/index.ts` | Upgrade relevant categories |
| `apps/backfill/src/` | Call `resolveBackfillConfig(provider.backfill, provider.categories)` instead of reading `provider.backfill.entityTypes` directly |
| `apps/console` (tRPC) | Any code that reads `provider.backfill.supportedEntityTypes` switches to `deriveSupportedEntityTypes(provider.categories)` |
| Database | If `gwInstallationBackfillConfig.entityTypes` stores `"issue"` (GitHub singular), a migration to `"issues"` is needed |

### Trade-offs and risks

**Benefits**:
- Provider authors define backfill handler exactly once, co-located with the category declaration
- Adding a new backfill entity type is a 1-field change (`type: "sync+observation"` + `backfill: handler`) instead of a 2-file change
- `supportedEntityTypes` is no longer manually listed — it derives from category keys automatically, eliminating a class of drift bugs
- The `backfill.ts` files per-provider disappear — the code is co-located or factored into named functions

**Risks**:
- **Key rename data migration**: GitHub's entity type key changes from `"issue"` to `"issues"`. Any stored `gwInstallationBackfillConfig.entityTypes` arrays in the database with `"issue"` would need migration. This is the highest-risk aspect.
- **Inline vs. split files**: Moving backfill handler logic into the category definition makes provider `index.ts` files significantly larger. Provider authors may prefer keeping handlers in a separate `backfill.ts` file but exporting them as named functions that are then referenced in the category definitions.
- **`categoryDefSchema` limitation**: `SyncObservationCategoryDef` contains a function (`BackfillEntityHandler`) so it cannot be a pure Zod schema. The validation boundary must be documented clearly: Zod validates the data fields (`type`, `label`, `description`); TypeScript validates the handler structurally.
- **The `"sync+observation"` type is currently unused** — all 5 providers use `"observation"`. The proposed migration is additive: providers that don't support backfill continue to use `"observation"`. The migration is opt-in per-provider.

### Dependencies on other synthesis changes

- Does NOT depend on any of the 10 core synthesis changes.
- Can be implemented independently after the core changes are merged.
- Would benefit from Change 7 (registry 1-touch) being done first so the test harness for derived unions is in place.

### Implementation effort estimate

**Medium** (3–5 days, 1 engineer):
- `define.ts` changes: ~2 hours
- Migrating 4 provider pairs (github, linear, sentry, vercel) to `sync+observation`: ~1 day per provider (handlers are non-trivial)
- Updating backfill service consumers: ~2 hours
- Data migration for GitHub key rename: ~1 hour (SQL + verification)
- Test coverage: ~1 day

---

## Innovation 3 — Typed Payload Pipeline — End-to-End

### Current state analysis

The current `transformWebhookPayload` function (`packages/console-providers/src/dispatch.ts`) already does the right thing at runtime — it calls `eventDef.schema.parse(payload)` before calling `eventDef.transform(parsed, ...)`. The types just don't flow through at compile time.

The three consumers that receive `payload: unknown`:

1. **Relay `payloadParseAndExtract` middleware** (`apps/relay/src/middleware/webhook.ts:268-327`) — reads `parsedPayload` from context as `unknown`. The relay does not run transforms — it just passes the parsed payload downstream via `WebhookReceiptPayload`.

2. **Console ingress** (`apps/console/src/app/api/gateway/ingress/route.ts:29-136`) — calls `transformEnvelope(envelope)` which calls `transformWebhookPayload`. The `payload` field of `WebhookEnvelope` is `unknown` at the call site. The dispatch function does `eventDef.schema.parse(payload)` at runtime.

3. **Backfill** (`packages/console-providers/src/providers/*/backfill.ts`) — does NOT consume `payload: unknown` — it builds payloads using adapter functions (`adaptGitHubPRForTransformer`, etc.) that return concrete typed values.

The key insight: **type safety is already achieved at the transform layer** (`dispatch.ts:30-31`). The gap is that:
- The relay context variable `parsedPayload` is typed as `unknown`
- `WebhookEnvelope.payload` is `z.unknown()`
- There are no compile-time checks that `envelope.payload` for a `"github"` provider with `"pull_request"` event type matches `preTransformGitHubPullRequestEventSchema`

### Proposed design

The `EventPayloadMap` type is derived entirely at the type level from `PROVIDERS`. No runtime changes are needed for the basic version.

```typescript
// packages/console-providers/src/typed-payload.ts (new file)

import type { z } from "zod";
import type { PROVIDERS } from "./registry";
import type { ProviderName } from "./registry";

/**
 * Maps provider name → event key → exact payload type.
 *
 * This is a pure type-level derivation from PROVIDERS.
 * It adds zero runtime code.
 *
 * Usage:
 *   type GitHubPRPayload = EventPayloadMap["github"]["pull_request"];
 *   // = z.infer<typeof preTransformGitHubPullRequestEventSchema>
 */
export type EventPayloadMap = {
  [P in ProviderName]: {
    [E in keyof (typeof PROVIDERS)[P]["events"]]: z.infer<
      (typeof PROVIDERS)[P]["events"][E]["schema"]
    >;
  };
};

/**
 * Typed webhook envelope — provider+eventType pair constrains the payload type.
 *
 * TypeScript narrows `payload` based on the combination of P and E.
 * When P and E are concrete literals (e.g., "github", "pull_request"),
 * payload has the exact type of that event's schema output.
 */
export type TypedWebhookEnvelope<
  P extends ProviderName = ProviderName,
  E extends keyof EventPayloadMap[P] = keyof EventPayloadMap[P],
> = {
  readonly deliveryId: string;
  readonly connectionId: string;
  readonly orgId: string;
  readonly provider: P;
  readonly eventType: E & string;
  readonly payload: EventPayloadMap[P][E];
  readonly receivedAt: number;
  readonly correlationId?: string;
};

/**
 * The union of all typed envelopes — safe to store, route, and discriminate.
 * Discriminating on `provider` narrows `payload` to that provider's event map.
 * Discriminating on both `provider` and `eventType` gives the exact payload type.
 */
export type AnyTypedWebhookEnvelope = {
  [P in ProviderName]: {
    [E in keyof EventPayloadMap[P]]: TypedWebhookEnvelope<P, E & string>;
  }[keyof EventPayloadMap[P]];
}[ProviderName];
```

The typed `transformWebhookPayload` function in `dispatch.ts` gains an overload:

```typescript
// packages/console-providers/src/dispatch.ts

/**
 * Typed overload — when provider and eventType are known at compile time,
 * the return type is narrowed to the specific event's PostTransformEvent.
 * The untyped overload (provider: SourceType, eventType: string) remains
 * for call sites where the types aren't known statically.
 */
export function transformWebhookPayload<
  P extends ProviderName,
  E extends keyof EventPayloadMap[P] & string,
>(
  provider: P,
  eventType: E,
  payload: EventPayloadMap[P][E],
  context: TransformContext
): PostTransformEvent;
export function transformWebhookPayload(
  provider: SourceType,
  eventType: string,
  payload: unknown,
  context: TransformContext
): PostTransformEvent | null;
export function transformWebhookPayload(
  provider: SourceType,
  eventType: string,
  payload: unknown,
  context: TransformContext
): PostTransformEvent | null {
  // ... existing implementation unchanged ...
}
```

**Type-safe handler example** (console ingest):

```typescript
// In a future typed handler — zero casts:
function handleGitHubPullRequest(
  envelope: TypedWebhookEnvelope<"github", "pull_request">
) {
  // envelope.payload is z.infer<typeof preTransformGitHubPullRequestEventSchema>
  // TypeScript knows: envelope.payload.action, envelope.payload.pull_request.id, etc.
  // No `as`, no `unknown`, no runtime risk.
}
```

**`WebhookEnvelope` wire schema** — two options:

Option A (additive, no breaking change): Keep `payload: z.unknown()` in the Zod runtime schema but create a `TypedWebhookEnvelope` TypeScript type that overlays the payload with a typed field. The two exist in parallel — Zod for runtime validation, TypeScript type for static narrowing.

Option B (full Zod expression): Express `TypedWebhookEnvelope` as a proper Zod schema using `z.discriminatedUnion("provider", [...])` where each provider branch has another discriminated union on `eventType`. This is runtime-complete but generates a very large Zod schema (one object per provider×event combination). For 5 providers × ~20 events total, this is ~20 Zod objects. Feasible.

```typescript
// Option B — Zod runtime representation (illustrative, not exhaustive):
const githubEnvelopeSchema = z.object({
  provider: z.literal("github"),
  eventType: z.string(),  // still string — eventType varies
  payload: z.unknown(),   // validated per-event by provider dispatch
  // ... other fields
});

// Full typed envelope — keep at TypeScript-only level (Option A is recommended)
// Reason: runtime Zod validation of payload shape happens at dispatch.ts,
// not at the envelope boundary. The envelope is a transport container.
```

**Recommendation**: Implement Option A (TypeScript-only `EventPayloadMap` + `TypedWebhookEnvelope`). The runtime validation of payload shapes already exists in `dispatch.ts:30`. The gap is compile-time narrowing, not runtime safety.

### Migration path

**Phase 1** — Add types, zero runtime changes:
1. Create `packages/console-providers/src/typed-payload.ts` with `EventPayloadMap` and `TypedWebhookEnvelope`
2. Export from `packages/console-providers/src/index.ts`
3. No existing code changes — the new types are additive

**Phase 2** — Adopt in console ingress (lowest risk):
1. `apps/console/src/app/api/gateway/ingress/_lib/transform.ts` — change `transformEnvelope` to accept `TypedWebhookEnvelope` when context allows
2. Event-specific handlers (if they exist) can be typed precisely

**Phase 3** — Relay context variable typing:
1. `apps/relay/src/middleware/webhook.ts` — `parsedPayload` context variable type upgrades from `unknown` to `EventPayloadMap[ProviderName][string]` or a union
2. This requires the relay to know the event's payload type at the point of parse — which it already does via `providerDef.webhook.parsePayload()`

### Trade-offs and risks

**Benefits**:
- Eliminates `payload as { type: string }` casts at every consumer
- Transform chain is verifiable end-to-end — schema changes in a provider's event definition produce TypeScript errors in all downstream consumers
- New event types or schema changes are caught at compile time, not at runtime

**Risks**:
- **`EventPayloadMap` is a large mapped type** — may increase TypeScript compilation time. For 5 providers × ~20 events, this is small. At 50+ providers, the type could become slow to compute.
- **Phase 3 (relay variable typing) is complex**: The relay middleware processes all providers behind a single `/:provider` route. The `parsedPayload` context variable would need to be typed as a union of all possible provider payloads, which is very wide. In practice, relay-side handlers don't need payload type safety — they just pass the payload along without inspecting it. Phase 3 may not be worth the complexity.
- **Wire schema gap**: `WebhookEnvelope.payload` remains `z.unknown()` at the Zod level. The `TypedWebhookEnvelope` TypeScript type is a separate, parallel abstraction. Care must be taken not to conflate the two.
- **TypeScript generics depth**: `TypedWebhookEnvelope<P, E>` has nested generic constraints. Some TypeScript versions may struggle to infer `E extends keyof EventPayloadMap[P]` in all contexts. This should be tested.

### Dependencies on other synthesis changes

- Depends on nothing from the 10 core synthesis changes.
- Benefits from Change 6 (`gateway.ts` split into `wire.ts`) — the wire types live in a cleaner file that this innovation extends.
- If Innovation 2 (category unification) is implemented, `EventPayloadMap` continues to work unchanged — it derives from `PROVIDERS[P].events`, not from `categories`.

### Implementation effort estimate

**Low-Medium** (2–3 days, 1 engineer):
- `typed-payload.ts` file creation: ~3 hours
- TypeScript overload on `transformWebhookPayload`: ~1 hour
- Integration tests for type narrowing (type-level assertions): ~2 hours
- Adopting in console ingress (Phase 2): ~1 day

---

## Innovation 4 — Relay Auto-Registration — Registry as Router

### Current state analysis

`apps/relay/src/routes/webhooks.ts` uses a single `webhooks.post("/:provider", ...)` route. This means:
- A single middleware stack handles all providers uniformly
- The `providerGuard` middleware filters invalid providers and non-webhook providers
- The actual per-provider logic is in `WebhookDef` methods called by the middleware chain

The existing design already achieves "auto-registration" in the sense that adding a provider to `PROVIDERS` makes it reachable at `/api/webhooks/:provider` automatically. The `providerGuard` handles the validation.

The innovation proposes a **fundamentally different architecture**: replace the single wildcard route with per-provider routes generated at startup. This changes the registration model from "one route, guard filters" to "N routes, each with tailored middleware."

**Key observations from the live code**:

1. The current middleware stack is already mostly provider-aware — it reads `providerDef` from context at each step. The steps are not truly "per-provider" today, but they could be.

2. `apps/relay/src/middleware/webhook.ts:65-82` — the `webhookSecretEnvKey` manual map is the concrete pain point. Synthesis Change 8 already addresses this by threading provider configs. Innovation 4 goes further by making the entire route structure registry-derived.

3. The relay's `app.ts` imports `webhooks` from `routes/webhooks.ts` and registers it. The Innovation 4 design would invert this: the registry generates the router, and `app.ts` mounts it.

### Proposed design

The relay router factory creates a Hono sub-application per webhook-capable provider. The factory is exported from `console-providers` so it can be tested in isolation.

```typescript
// packages/console-providers/src/relay-factory.ts (new file)

import { Hono } from "hono";
import type { ProviderDefinition } from "./define";
import { hasInboundWebhooks } from "./define";
import type { ProviderName } from "./registry";
import { PROVIDERS } from "./registry";

/**
 * Provider configs keyed by provider name.
 * Partial: providers are optional — absent when env vars are missing.
 */
export type ProviderConfigs = Partial<Record<ProviderName, unknown>>;

/**
 * Create a Hono router from the PROVIDERS registry.
 *
 * For each webhook-capable provider that has a config, registers:
 *   POST /:provider — the full middleware stack for that provider
 *
 * This is a pure function — it does not access env or DB.
 * The caller (relay app) provides providerConfigs built from env.
 *
 * EXTENSION POINT: buildMiddlewareStack is injectable for testing.
 */
export function createWebhookRouter<T extends typeof PROVIDERS>(
  providers: T,
  providerConfigs: ProviderConfigs,
  options?: {
    /**
     * Override middleware stack builder — useful for testing.
     * Default: buildStandardMiddlewareStack
     */
    buildMiddleware?: (
      provider: ProviderDefinition,
      config: unknown
    ) => Parameters<Hono["use"]>[1][];
  }
): Hono {
  const app = new Hono();

  for (const [name, provider] of Object.entries(providers)) {
    if (!hasInboundWebhooks(provider)) continue;

    const config = providerConfigs[name as ProviderName];
    if (!config) continue; // provider not configured in this environment

    const middlewareStack = options?.buildMiddleware
      ? options.buildMiddleware(provider as ProviderDefinition, config)
      : buildStandardMiddlewareStack(provider as ProviderDefinition, config);

    app.post(`/${name}`, ...middlewareStack, buildWebhookHandler(name as ProviderName));
  }

  return app;
}

/**
 * Build the standard webhook middleware stack for a provider.
 * Each middleware is bound to the specific provider's config — no
 * dynamic dispatch or context-based provider lookup needed.
 */
function buildStandardMiddlewareStack(
  provider: ProviderDefinition,
  config: unknown
): Parameters<Hono["use"]>[1][] {
  // Returns the ordered middleware array:
  // [serviceAuthDetect, serviceAuthBodyValidator, webhookHeaderGuard,
  //  rawBodyCapture, signatureVerify, payloadParseAndExtract]
  //
  // Key difference from current design:
  // - signatureVerify is pre-bound to `provider` and `config`
  //   rather than doing a runtime lookup
  // - providerGuard is eliminated — the route only exists for
  //   this specific provider
  return [
    serviceAuthDetect,
    buildServiceAuthBodyValidator(),
    buildWebhookHeaderGuard(provider),
    rawBodyCapture,
    buildSignatureVerify(provider, config),
    buildPayloadParseAndExtract(provider),
  ];
}
```

`apps/relay/src/app.ts` (updated):

```typescript
// BEFORE:
import { webhooks } from "./routes/webhooks.js";
app.route("/api/webhooks", webhooks);

// AFTER:
import { createWebhookRouter } from "@repo/app-providers/relay-factory";
const providerConfigs = buildProviderConfigs(env); // mirrors gateway pattern
const webhookRouter = createWebhookRouter(PROVIDERS, providerConfigs);
app.route("/api/webhooks", webhookRouter);
```

`apps/relay/src/routes/webhooks.ts` is deleted entirely.

**What changes in the middleware**:

The current `providerGuard` and `signatureVerify` middlewares do runtime lookups. In the factory model, they become factories that return bound middleware:

```typescript
// relay/src/middleware/webhook.ts (restructured)

// BEFORE:
export const signatureVerify = createMiddleware(async (c, next) => {
  const providerName = c.get("providerName");
  const secretEnvKey = webhookSecretEnvKey[providerName]; // manual map
  const secret = env[secretEnvKey];
  const valid = providerDef.webhook.verifySignature(rawBody, headers, secret);
  // ...
});

// AFTER — factory returns a middleware bound to specific provider+config:
export function buildSignatureVerify(
  provider: ProviderDefinition,
  config: unknown
) {
  return createMiddleware(async (c, next) => {
    const rawBody = c.get("rawBody");
    if (!rawBody) return c.json({ error: "missing_body" }, 400);

    // For WebhookProvider: secret from extractSecret(config)
    // For ManagedProvider: secret from c.get("connectionWebhookSetupState").signingSecret
    let secret: string;
    if (isWebhookProvider(provider)) {
      secret = (provider as WebhookProvider<unknown>).webhook.extractSecret(config);
    } else if (isManagedProvider(provider)) {
      const state = c.get("webhookSetupState");
      if (!state) return c.json({ error: "no_webhook_setup_state" }, 500);
      secret = state.signingSecret;
    } else {
      return c.json({ error: "unknown_provider_kind" }, 500);
    }

    const webhookDef = isWebhookProvider(provider)
      ? provider.webhook
      : (provider as ManagedProvider).inbound.webhook;

    const verify = webhookDef.verifySignature ?? deriveVerifySignature(webhookDef.signatureScheme);
    const valid = verify(rawBody, c.req.raw.headers, secret);
    if (!valid) return c.json({ error: "invalid_signature" }, 401);

    return await next();
  });
}
```

### Service auth path in factory model

The service auth path (`isServiceAuth === true`) currently uses `providerGuard` output to call `providerDef.webhook.parsePayload`. In the factory model, each per-provider route has its own `buildPayloadParseAndExtract(provider)` middleware that is pre-bound. The service auth path still works because the route itself identifies the provider.

However, the service auth path currently goes to any `/:provider` route including non-webhook providers (it's filtered by `providerGuard`). In the factory model, only webhook-capable providers have routes, so the filtering is implicit.

### What changes in which files

| File | Change |
|---|---|
| `packages/console-providers/src/relay-factory.ts` | New file — `createWebhookRouter`, middleware factory functions |
| `packages/console-providers/src/index.ts` | Export `createWebhookRouter` from `relay-factory.ts` |
| `apps/relay/src/app.ts` | Replace `import { webhooks }` with `createWebhookRouter(PROVIDERS, configs)` |
| `apps/relay/src/routes/webhooks.ts` | Deleted |
| `apps/relay/src/middleware/webhook.ts` | Refactored: `providerGuard` deleted, remaining middlewares become factory functions |

### Trade-offs and risks

**Benefits**:
- Adding a provider to `PROVIDERS` with a webhook capability automatically creates a route in the relay — zero relay code changes needed
- The relay service is "provably correct": it can only handle providers with webhook capability that are configured in the current environment
- Per-provider middleware stack enables future specialization: different retry policies, different timeout budgets, provider-specific rate limiting
- Eliminates `webhookSecretEnvKey` manual map entirely (already addressed by Change 8, but this goes further)
- The relay `routes/webhooks.ts` file is deleted — the relay shrinks to essentially a bootstrap file

**Risks**:
- **Route explosion at scale**: 50 providers × 1 route = 50 registered Hono routes. This is trivial for Hono (which uses a trie router internally) and is not a performance concern.
- **`buildMiddlewareStack` complexity**: The factory function must be carefully designed to handle both `WebhookProvider` and `ManagedProvider` secret resolution paths. This is non-trivial but tractable with the `hasInboundWebhooks` guard.
- **Testing surface changes**: Current tests likely target the single `/:provider` route. After this change, each provider has its own route. Integration tests may need updating.
- **Service auth path**: The service auth path currently accepts requests to any valid provider name. In the factory model, it only works for providers that are configured. If a provider is disabled (env vars absent), its route doesn't exist — service auth calls to that provider would 404 instead of getting a "provider not configured" response. This behavior change must be communicated.
- **Cross-provider middleware reuse**: The current design shares one middleware instance across all providers. The factory creates N instances. For stateless middlewares (all current ones are stateless), this is fine. For future stateful or rate-limiting middlewares, the factory must instantiate them correctly.

### Dependencies on other synthesis changes

- **Depends on Change 3** (`SignatureScheme` on `WebhookDef`) — the factory's `buildSignatureVerify` calls `deriveVerifySignature(scheme)` which requires `signatureScheme` to exist on `WebhookDef`
- **Depends on Change 4** (`ManagedProvider`) — the factory must handle `isManagedProvider` in `buildSignatureVerify` for the `signingSecret` path
- **Depends on Change 8** (relay config threading) — the factory receives `providerConfigs` built by the same `p.createConfig(env, runtime)` pattern established in Change 8

### Implementation effort estimate

**Medium** (3–4 days, 1 engineer):
- `relay-factory.ts` design and implementation: ~1.5 days
- Middleware refactoring (factory functions): ~1 day
- `app.ts` wiring: ~2 hours
- Deleting `routes/webhooks.ts` and updating tests: ~0.5 day

---

## Innovation 7 — Provider Telemetry Schema — Observable-First Design

### Current state analysis

The live codebase has these logging points inside provider-related code:

1. `apps/relay/src/middleware/webhook.ts:176-180` — `log.warn` with missing headers
2. `apps/relay/src/middleware/webhook.ts:230-239` — `log.warn` with missing secret
3. `apps/relay/src/middleware/webhook.ts:248-258` — `log.warn` on signature mismatch
4. `apps/relay/src/middleware/webhook.ts:199-208` — `log.info` on raw body capture
5. `packages/console-providers/src/providers/sentry/index.ts:58` — `console.error` (raw, unstructured)

Provider functions themselves (`getInstallationToken`, `exchangeLinearCode`, etc.) emit nothing — they throw errors which propagate up to service-level handlers. The `correlationId` field exists in `webhookReceiptPayloadSchema` and `webhookEnvelopeSchema` but is never passed into provider function calls.

**Critical gap**: There is no way to answer "how long did GitHub token generation take for this specific request?" from logs alone. The provider function `getInstallationToken` does not emit any structured measurement.

### Proposed design

Each provider function receives a `ProviderContext` with a typed `emit` function. The telemetry events are declared as a Zod discriminated union, validated at emit time, and forwarded to the observability platform.

```typescript
// packages/console-providers/src/telemetry.ts (new file)

import { z } from "zod";
import { signatureSchemeSchema } from "./define";

// ── Telemetry Event Definitions (Zod-first — pure data) ───────────────────────

/**
 * Auth token was successfully generated.
 * Emitted by: AppTokenDef.getActiveToken, OAuthDef.getActiveToken
 */
const authTokenGeneratedSchema = z.object({
  kind: z.literal("auth.token_generated"),
  durationMs: z.number(),
  /** Installation ID or external ID for app-token providers */
  installationId: z.string(),
  /** Token type for debugging (never includes the actual token) */
  tokenType: z.enum(["installation", "app", "oauth", "api-key"]),
});

/**
 * Auth token generation failed.
 * Emitted by: AppTokenDef.getActiveToken, OAuthDef.getActiveToken
 */
const authTokenFailedSchema = z.object({
  kind: z.literal("auth.token_failed"),
  reason: z.string(),
  installationId: z.string(),
  httpStatus: z.number().optional(),
});

/**
 * OAuth code exchange completed.
 * Emitted by: OAuthDef.exchangeCode
 */
const authCodeExchangedSchema = z.object({
  kind: z.literal("auth.code_exchanged"),
  durationMs: z.number(),
  success: z.boolean(),
  httpStatus: z.number().optional(),
});

/**
 * Webhook signature was verified.
 * Emitted by: WebhookDef.verifySignature (or deriveVerifySignature)
 */
const webhookSignatureVerifiedSchema = z.object({
  kind: z.literal("webhook.signature_verified"),
  scheme: signatureSchemeSchema.pick({ kind: true }),
  durationMs: z.number(),
  valid: z.boolean(),
});

/**
 * A backfill page was fetched from the provider API.
 * Emitted by: BackfillEntityHandler.processResponse
 */
const backfillPageFetchedSchema = z.object({
  kind: z.literal("backfill.page_fetched"),
  entityType: z.string(),
  pageSize: z.number(),
  cursor: z.string().nullable(),
  durationMs: z.number(),
  /** Whether the response indicated more pages exist */
  hasMore: z.boolean(),
});

/**
 * An API rate limit response was received.
 * Emitted by: ProviderApi.parseRateLimit consumers
 */
const apiRateLimitSchema = z.object({
  kind: z.literal("api.rate_limit"),
  remaining: z.number(),
  resetAtMs: z.number(),
  /** True if the request was blocked (remaining === 0) */
  blocked: z.boolean(),
});

/**
 * Union of all telemetry events a provider can emit.
 * Discriminated by `kind`. Fully Zod-validated at emit time.
 */
export const telemetryEventSchema = z.discriminatedUnion("kind", [
  authTokenGeneratedSchema,
  authTokenFailedSchema,
  authCodeExchangedSchema,
  webhookSignatureVerifiedSchema,
  backfillPageFetchedSchema,
  apiRateLimitSchema,
]);
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

// ── Provider Context ───────────────────────────────────────────────────────────

/**
 * Context passed to provider functions that emit telemetry.
 * Provider functions receive this from the platform, not from env.
 *
 * Passed to: getActiveToken, exchangeCode, verifySignature, processResponse
 */
export interface ProviderContext {
  /**
   * Emit a structured telemetry event.
   * Validated against telemetryEventSchema before forwarding.
   * Best-effort: emit() never throws, even if validation fails.
   */
  readonly emit: (event: TelemetryEvent) => void;
  /**
   * Cross-service correlation ID — connects relay receipt to
   * QStash dispatch to console ingest to backfill run.
   * From webhookReceiptPayloadSchema.correlationId.
   */
  readonly correlationId: string;
}

/**
 * No-op context — for call sites that don't have a correlation ID
 * (e.g., dev tools, one-off scripts, tests without Sentry).
 */
export const noopProviderContext: ProviderContext = {
  emit: () => undefined,
  correlationId: "noop",
};

// ── Platform Telemetry Emitter ─────────────────────────────────────────────────

/**
 * Create a provider context that emits to the observability platform.
 * Call once per request in service handlers (relay middleware, gateway handlers).
 *
 * @param correlationId - From the incoming request's correlation ID header
 * @param onEmit - Platform-specific emit function (Sentry span, Datadog trace, log)
 */
export function createProviderContext(
  correlationId: string,
  onEmit: (event: TelemetryEvent, correlationId: string) => void
): ProviderContext {
  return {
    correlationId,
    emit(event: TelemetryEvent) {
      try {
        const validated = telemetryEventSchema.parse(event);
        onEmit(validated, correlationId);
      } catch {
        // Never throw from telemetry — observability is best-effort
      }
    },
  };
}
```

### Adopting `ProviderContext` in provider function signatures

The key question is which functions receive `ProviderContext`. The principle: functions that perform network I/O or crypto operations should receive it. Functions that are purely computational do not need it.

**Functions that receive `ProviderContext`** (network I/O or HMAC):

| Function | Emits |
|---|---|
| `AppTokenDef.getActiveToken` | `auth.token_generated`, `auth.token_failed` |
| `OAuthDef.getActiveToken` | `auth.token_generated`, `auth.token_failed` |
| `OAuthDef.exchangeCode` | `auth.code_exchanged` |
| `WebhookDef.verifySignature` | `webhook.signature_verified` |
| `BackfillEntityHandler.processResponse` | `backfill.page_fetched` |

**Functions that do NOT need `ProviderContext`** (pure computation or data):
- `buildAuthUrl` — pure string building
- `processCallback` — receives and processes callback params (no ongoing I/O)
- `extractDeliveryId`, `extractEventType`, `extractResourceId` — pure extraction
- `parsePayload` — Zod parse, throws if invalid
- `buildRequest` — pure param building

### Interface changes

The `ProviderContext` parameter is added as a trailing optional argument to minimize migration pain:

```typescript
// packages/console-providers/src/define.ts

// AuthDef changes:
export interface OAuthDef<TConfig, TAccountInfo> {
  // Existing:
  getActiveToken(
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null
  ): Promise<string>;

  // After — context is optional for backward compat:
  getActiveToken(
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null,
    ctx?: ProviderContext  // NEW — optional
  ): Promise<string>;
}

// Same pattern for AppTokenDef.getActiveToken, OAuthDef.exchangeCode

// WebhookDef changes:
export interface WebhookDef<TConfig> {
  // After:
  verifySignature?: (
    rawBody: string,
    headers: Headers,
    secret: string,
    ctx?: ProviderContext  // NEW — optional
  ) => boolean;
}

// BackfillEntityHandler changes:
export interface BackfillEntityHandler {
  processResponse(
    data: unknown,
    ctx: BackfillContext,
    cursor: unknown,
    responseHeaders?: Record<string, string>,
    telemetry?: ProviderContext  // NEW — optional
  ): {
    events: BackfillWebhookEvent[];
    nextCursor: unknown | null;
    rawCount: number;
  };
}
```

### Usage in provider implementations

GitHub `getActiveToken` emitting telemetry:

```typescript
// providers/github/index.ts (after)
getActiveToken: async (config, storedExternalId, _storedAccessToken, ctx) => {
  const start = Date.now();
  try {
    const token = await getInstallationToken(config, storedExternalId);
    ctx?.emit({
      kind: "auth.token_generated",
      durationMs: Date.now() - start,
      installationId: storedExternalId,
      tokenType: "installation",
    });
    return token;
  } catch (err) {
    ctx?.emit({
      kind: "auth.token_failed",
      reason: err instanceof Error ? err.message : String(err),
      installationId: storedExternalId,
    });
    throw err;
  }
},
```

### Platform-side context wiring

The relay middleware creates a `ProviderContext` at the start of each request and passes it to provider functions:

```typescript
// apps/relay/src/middleware/webhook.ts (additions)

// In signatureVerify middleware:
const correlationId = c.get("correlationId") ?? crypto.randomUUID();
const telemetry = createProviderContext(correlationId, (event, cid) => {
  // Forward to observability platform:
  log.info("[telemetry]", { ...event, correlationId: cid });
  // Or: Sentry.addBreadcrumb({ data: event })
  // Or: datadogTracer.addTags(event)
});

const verify = webhookDef.verifySignature ?? deriveVerifySignature(webhookDef.signatureScheme);
const valid = verify(rawBody, headers, secret, telemetry);  // context passed here
```

```typescript
// apps/gateway/src/routes/connections.ts (additions)
// When calling auth.getActiveToken:
const ctx = createProviderContext(c.get("correlationId") ?? "unknown", forwardToSentry);
const token = await providerDef.auth.getActiveToken(config, externalId, storedToken, ctx);
```

### What changes in which files

| File | Change |
|---|---|
| `packages/console-providers/src/telemetry.ts` | New file — `telemetryEventSchema`, `ProviderContext`, `createProviderContext`, `noopProviderContext` |
| `packages/console-providers/src/define.ts` | Add optional `ctx?: ProviderContext` to `getActiveToken`, `exchangeCode`, `verifySignature`, `processResponse` |
| `packages/console-providers/src/index.ts` | Export `ProviderContext`, `TelemetryEvent`, `createProviderContext`, `noopProviderContext` from telemetry |
| `packages/console-providers/src/providers/github/index.ts` | Adopt `ctx?.emit(...)` in `getActiveToken` |
| `packages/console-providers/src/providers/linear/index.ts` | Adopt `ctx?.emit(...)` in `getActiveToken`, `exchangeCode` |
| `packages/console-providers/src/providers/sentry/index.ts` | Delete `console.error`, replace with `ctx?.emit(auth.token_failed)` pattern |
| `packages/console-providers/src/providers/*/backfill.ts` | Adopt `telemetry?.emit(backfill.page_fetched)` in `processResponse` |
| `apps/relay/src/middleware/webhook.ts` | Create `ProviderContext` per request, pass to `verifySignature` |
| `apps/gateway/src/routes/connections.ts` | Create `ProviderContext` per request, pass to `getActiveToken`, `exchangeCode` |
| `apps/backfill/src/` | Create `ProviderContext` per backfill run, pass to `processResponse` |

### Trade-offs and risks

**Benefits**:
- All provider operations (token generation, signature verification, page fetches) emit structured, Zod-validated telemetry — not unstructured log strings
- The `correlationId` connects relay receipt → QStash dispatch → console ingest → backfill run into a single distributed trace
- Adding new telemetry events is a 2-step process: add to `telemetryEventSchema`, adopt in the relevant provider function
- The Zod-validated discriminated union enables strict deserialization in log aggregators (Datadog, Sentry) — no custom parsing rules needed
- `emit()` is best-effort and never throws — telemetry cannot affect request handling

**Risks**:
- **Signature change propagation**: Adding `ctx?: ProviderContext` to `getActiveToken` and `verifySignature` changes function signatures. Call sites in gateway and relay must update. Optional parameter minimizes this, but it is still a code touch.
- **Telemetry cardinality**: `backfill.page_fetched` could emit 1000+ events per backfill run (100 pages × 10 entity types × 1 installation). The `onEmit` implementation must be careful not to create high-cardinality metrics from raw event count. Use counters/histograms, not individual spans.
- **`ProviderContext` in `BackfillEntityHandler`**: The parameter name collision with `BackfillContext` (the existing `ctx` parameter in `processResponse`) is confusing. The proposed rename to `telemetry?: ProviderContext` makes the parameter name distinct.
- **Test impact**: Provider functions that previously only took config and domain params now optionally take `ProviderContext`. Tests that exercise these functions directly continue to work (optional param). Tests for telemetry emission require a mock `ProviderContext`.

### Dependencies on other synthesis changes

- Does NOT depend on any of the 10 core synthesis changes.
- Benefits from Change 3 (`SignatureScheme`) — `webhookSignatureVerifiedSchema` emits `scheme.kind` which is typed by `signatureSchemeSchema.pick({ kind: true })`.
- If Innovation 4 (relay factory) is implemented, the factory's middleware builders (`buildSignatureVerify`) are natural injection points for `createProviderContext`.
- If Innovation 2 (category unification) is implemented, `BackfillEntityHandler.processResponse` in the new category-inline form receives `telemetry?: ProviderContext` as before.

### Implementation effort estimate

**Medium** (3–4 days, 1 engineer):
- `telemetry.ts` schema + context types: ~3 hours
- `define.ts` signature changes: ~1 hour
- Provider implementation adoption (5 providers × `getActiveToken` + backfill handlers): ~2 days
- Service-level context creation in relay + gateway + backfill: ~1 day
- Test coverage: ~0.5 day

---

## Combined Innovation Dependency Graph

```
Core Synthesis Changes (already decided)
    Change 1 (AppTokenDef)
    Change 3 (SignatureScheme)
    Change 4 (ManagedProvider)
    Change 8 (Relay config threading)
         │
         ▼
Innovation 4 (Relay Factory)
    depends on: Change 3, Change 4, Change 8
    enables: per-provider middleware, relay deletion

Innovation 7 (Telemetry)
    depends on: nothing (optional params — independent)
    benefits from: Change 3 (scheme type in telemetry), Innovation 4 (injection points)

Innovation 2 (Category/Backfill Unification)
    depends on: nothing (independent redesign)
    risk: key rename data migration (GitHub "issue" → "issues")
    enables: backfill.ts file deletion per provider

Innovation 3 (Typed Payload Pipeline)
    depends on: nothing (type-only addition)
    benefits from: Change 6 (wire.ts split — cleaner file for overlay)
    enables: zero-cast handlers in console ingest
```

---

## Recommended Implementation Order

Given the dependencies above and relative risks:

1. **Innovation 3 first** — pure TypeScript types, zero runtime risk, zero breaking changes. Can be merged as soon as the core synthesis changes (1–10) are done. The `EventPayloadMap` + `TypedWebhookEnvelope` types are a free addition.

2. **Innovation 7 second** — optional parameter additions are backward-compatible. Adopting telemetry in provider functions can be done incrementally (one provider at a time). The `telemetry.ts` schema file is independent of everything else.

3. **Innovation 4 third** — depends on Changes 3, 4, 8 from the synthesis being complete. Once those are merged, the relay factory is a significant but bounded refactor. The relay service shrinks dramatically.

4. **Innovation 2 last** — requires careful key rename planning (the `"issue"` → `"issues"` GitHub entity type key change needs a database migration). Should only be done when there's confidence in the migration path. The deferred design work here is not about types but about data migration safety.

---

## Code References

- `packages/console-providers/src/define.ts:13-18` — `categoryDefSchema` (Innovation 2 modifies)
- `packages/console-providers/src/define.ts:357-362` — `BackfillDef` interface (Innovation 2 simplifies)
- `packages/console-providers/src/define.ts:79-96` — `WebhookDef` (Innovation 7 adds optional `ctx` to `verifySignature`)
- `packages/console-providers/src/define.ts:298-324` — `BackfillEntityHandler` (Innovation 7 adds optional `telemetry` to `processResponse`)
- `packages/console-providers/src/dispatch.ts:15-32` — `transformWebhookPayload` (Innovation 3 adds typed overload)
- `packages/console-providers/src/gateway.ts:48-65` — `webhookEnvelopeSchema` with `payload: z.unknown()` (Innovation 3 context)
- `packages/console-providers/src/providers/github/backfill.ts:100-197` — `githubBackfill` with `entityTypes` (Innovation 2 dissolves this file)
- `packages/console-providers/src/providers/linear/backfill.ts:381-491` — `linearBackfill` (Innovation 2 dissolves)
- `packages/console-providers/src/providers/sentry/backfill.ts:135-137` — entity key overlap analysis
- `packages/console-providers/src/providers/sentry/index.ts:58` — raw `console.error` (Innovation 7 replaces)
- `apps/relay/src/app.ts:65` — `app.route("/api/webhooks", webhooks)` (Innovation 4 replaces with factory)
- `apps/relay/src/routes/webhooks.ts:44-52` — static `/:provider` route (Innovation 4 deletes this file)
- `apps/relay/src/middleware/webhook.ts:65-82` — `webhookSecretEnvKey` manual map (addressed by Change 8; fully eliminated by Innovation 4)
- `apps/relay/src/middleware/webhook.ts:248-258` — signature mismatch log (Innovation 7 adds structured emit alongside)
- `apps/console/src/app/api/gateway/ingress/route.ts:29` — `serve<WebhookEnvelope>` (Innovation 3 can type to `serve<AnyTypedWebhookEnvelope>`)
- `apps/console/src/app/api/gateway/ingress/_lib/transform.ts:12-24` — `transformEnvelope` (Innovation 3 typed overload consumer)

---

## Related Research

- `thoughts/shared/research/2026-03-17-provider-architecture-redesign.md` — original 7-innovation analysis
- `thoughts/shared/research/2026-03-18-provider-architecture-synthesis.md` — 10 core changes (already decided)
- `thoughts/shared/research/2026-03-17-lifecycle-reason-webhook-correlation.md` — lifecycle/webhook correlation (context for Innovation 7)
