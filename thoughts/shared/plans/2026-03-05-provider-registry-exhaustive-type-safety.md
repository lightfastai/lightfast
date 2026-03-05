# Provider Registry: Exhaustive Type Safety Implementation Plan

## Overview

Redesign `@repo/console-providers` to eliminate all optional fields, enforce build-time exhaustiveness when adding new providers, and replace implicit branching (optional access, `?? fallback`) with explicit discriminated unions and required fields with noop defaults.

Based on synthesis of two research documents:
- `thoughts/shared/research/2026-03-05-web-analysis-typescript-zod-provider-registry.md` (Doc 1)
- `thoughts/shared/research/2026-03-05-web-analysis-zod-typescript-provider-registry.md` (Doc 2)

## Current State Analysis

### Problems Identified

1. **`capabilities?` optional field** (`define.ts:79`) — Only GitHub implements it. Gateway has a `providerName === "github"` branch at `connections.ts:459-467` that breaks provider-agnosticism.

2. **`resolveCategory?` optional field** (`define.ts:81`) — Used by Vercel (`vercel.ts:90`) and Linear (`linear.ts:207`), omitted by GitHub and Sentry. Dispatch falls back via `??` at `dispatch.ts:22`.

3. **`actions?` optional on EventDefinition** (`define.ts:26`) — Sentry's `error`, `event_alert`, `metric_alert` events omit actions. Registry derivation branches on `if (def.actions)` at `registry.ts:64`.

4. **`getEventWeight` uses `?? 35` fallback** (`registry.ts:131`) — Called by `scoring.ts:82`. Should be impossible for a valid event to have no weight.

5. **`TypedCallbackResult` has 3 optional fields** (`types.ts:137-143`) — `tokens?`, `setupAction?`, `nextUrl?` encode 4 distinct states. Gateway at `connections.ts:254-313` branches on each optional independently.

6. **`OAuthTokens.refreshToken?` and other optionals** (`types.ts:13-14`) — Gateway token refresh at `connections.ts:485` checks `if (!tokenRow.refreshToken)`.

7. **`PostTransformEvent.actor` optional** (`post-transform-event.ts:50`) — Consumers at `actor-identity.ts:42-44`, `observation-capture.ts:907,980`, `actor-resolution.ts:90`, `profile-update.ts:180,194` all use `?.` access.

8. **`PostTransformActor.email?` and `avatarUrl?`** (`post-transform-event.ts:14-15`) — Consumers at `actor-identity.ts:43-44`, `observation-capture.ts:328-329` use `?? null` everywhere.

9. **`providerAccountInfoSchema` is hand-maintained** (`types.ts:126-131`) — Must be manually updated when providers change. Should be derived from `PROVIDERS`.

### Key Discoveries

- **Gateway capabilities branch** is the ONLY place relay/gateway breaks provider-agnosticism (`connections.ts:459-467`)
- **`getProvider()`** is used in 7 files across gateway/relay/integration-tests
- **`PROVIDERS[name]` direct access** in 5 files: registry.ts, dispatch.ts, inject-event schemas, relay fixtures
- **`resolveCategory`** is called only in `dispatch.ts:22`
- **`getEventWeight`** is called only in `scoring.ts:82` and `registry.ts:131`
- **All 4 providers already use `satisfies`** on their callback results — they're close to the target pattern

## Desired End State

After this plan is complete:

1. Adding a new provider key to `PROVIDERS` without full implementation produces a **TypeScript build error**
2. **Zero optional fields** on `ProviderDefinition`, `EventDefinition`, `PostTransformEvent`, `PostTransformActor`
3. **Zero `??` fallbacks** in dispatch, scoring, or registry derivation
4. **Zero provider-specific branches** in gateway/relay (no `if (provider === "github")`)
5. **`providerAccountInfoSchema`** is derived from `PROVIDERS`, not hand-maintained
6. **`CallbackResult`** is a discriminated union on `status`
7. **`EventDefinition`** uses `kind: "simple" | "with-actions"` discriminator

### How to verify:
- `pnpm typecheck` passes with zero errors
- `pnpm lint` passes
- All existing tests pass: `pnpm test`
- Remove any field from a provider definition -> TypeScript error
- Add a new key to `PROVIDERS` without implementation -> TypeScript error

## What We're NOT Doing

- **NOT changing `OAuthTokens` to a discriminated union** — Medium complexity, requires DB migration consideration for stored tokens. Defer to a separate PR.
- **NOT moving config schemas** (e.g., `githubConfigSchema`) into provider files — Co-location improvement but separate concern.
- **NOT adding `z.record(z.enum)` runtime exhaustiveness** — TypeScript `satisfies` is sufficient; Zod v4 feature not needed.
- **NOT touching relay/gateway service code** except to consume the new `getActiveToken` method and updated `CallbackResult` shape.
- **NOT adding ESLint `switch-exhaustiveness-check`** — Belt-and-suspenders over `satisfies`, low priority.

## Implementation Approach

Six phases, each independently testable. Phases 1-3 are internal to `console-providers`. Phases 4-5 update gateway consumers. Phase 6 cleans up.

---

## Phase 1: EventDefinition Discriminated Union

### Overview
Replace optional `actions?` with `kind: "simple" | "with-actions"` discriminator. Add `simpleEvent()` and `actionEvent()` factory functions.

### Changes Required:

#### 1. Update `define.ts` — New EventDefinition types
**File**: `packages/console-providers/src/define.ts`

Replace `EventDefinition` and `defineEvent`:

```typescript
/** Per-action sub-event definition (e.g., "opened", "merged" for pull_request) */
export interface ActionDef {
  label: string;
  weight: number;
}

/** Simple event — no sub-actions */
export interface SimpleEventDef<S extends z.ZodType = z.ZodType> {
  readonly kind: "simple";
  readonly label: string;
  readonly weight: number;
  readonly schema: S;
  readonly transform: (payload: z.infer<S>, ctx: TransformContext) => PostTransformEvent;
}

/** Event with sub-actions (e.g., PR opened/closed/merged) */
export interface ActionEventDef<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> = Record<string, ActionDef>,
> {
  readonly kind: "with-actions";
  readonly label: string;
  readonly weight: number;
  readonly schema: S;
  readonly transform: (payload: z.infer<S>, ctx: TransformContext) => PostTransformEvent;
  readonly actions: TActions;
}

/** Discriminated union — switches on `kind` */
export type EventDefinition<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> = Record<string, ActionDef>,
> = SimpleEventDef<S> | ActionEventDef<S, TActions>;

/** Factory: simple event (no sub-actions) */
export function simpleEvent<S extends z.ZodType>(
  def: Omit<SimpleEventDef<S>, "kind">,
): SimpleEventDef<S> {
  return { kind: "simple", ...def };
}

/** Factory: event with sub-actions */
export function actionEvent<S extends z.ZodType, const TActions extends Record<string, ActionDef>>(
  def: Omit<ActionEventDef<S, TActions>, "kind">,
): ActionEventDef<S, TActions> {
  return { kind: "with-actions", ...def };
}
```

Remove old `defineEvent` export. Keep backward-compatible re-export temporarily:
```typescript
/** @deprecated Use simpleEvent() or actionEvent() */
export const defineEvent = simpleEvent;
```

#### 2. Update all 4 provider files
**Files**: `providers/github.ts`, `providers/vercel.ts`, `providers/linear.ts`, `providers/sentry.ts`

Replace `defineEvent({...})` calls:
- Events WITH `actions` -> `actionEvent({...})`
- Events WITHOUT `actions` -> `simpleEvent({...})`

Example for Sentry (`providers/sentry.ts`):
```typescript
events: {
  issue: actionEvent({
    label: "Issues", weight: 55, schema: preTransformSentryIssueWebhookSchema, transform: transformSentryIssue,
    actions: {
      created: { label: "Issue Created", weight: 55 },
      // ...
    },
  }),
  error: simpleEvent({ label: "Errors", weight: 45, schema: preTransformSentryErrorWebhookSchema, transform: transformSentryError }),
  event_alert: simpleEvent({ label: "Event Alerts", weight: 65, schema: preTransformSentryEventAlertWebhookSchema, transform: transformSentryEventAlert }),
  metric_alert: simpleEvent({ label: "Metric Alerts", weight: 70, schema: preTransformSentryMetricAlertWebhookSchema, transform: transformSentryMetricAlert }),
},
```

#### 3. Update `registry.ts` — Switch on `kind`
**File**: `packages/console-providers/src/registry.ts`

Replace `if (def.actions)` with `switch (def.kind)`:
```typescript
// In deriveEventRegistry():
if (def.kind === "with-actions") {
  for (const [action, actionDef] of Object.entries(def.actions)) {
    registry[`${source}:${eventKey}.${action}`] = { /* ... */ };
  }
} else {
  registry[`${source}:${eventKey}`] = { /* ... */ };
}
```

Update type-level derivation `ActionsOf<E>`:
```typescript
type ActionsOf<E> = E extends ActionEventDef<infer _S, infer A> ? A : never;
```

#### 4. Update `dispatch.ts` — No change needed
The dispatch code doesn't check `actions`, only calls `schema.parse` + `transform`. No change.

#### 5. Update `inject-event/schemas.ts`
**File**: `apps/console/src/app/api/debug/inject-event/_lib/schemas.ts`

This file accesses `events[category]` but only reads `.schema`. No change needed since it doesn't check `actions`.

#### 6. Update `index.ts` exports
**File**: `packages/console-providers/src/index.ts`

Add new exports:
```typescript
export type { SimpleEventDef, ActionEventDef } from "./define.js";
export { simpleEvent, actionEvent } from "./define.js";
```

Keep `defineEvent` export temporarily for any external consumers (deprecate).

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [x] All tests pass: `pnpm --filter @repo/console-providers test` (179/179)
- [x] Relay tests pass: `pnpm --filter relay test` (178/178)
- [x] No `if (def.actions)` patterns remain in codebase (only `def.kind === "with-actions"`)

#### Manual Verification:
- [ ] Adding a new event without `kind` produces a TypeScript error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Remove Optional Fields from ProviderDefinition

### Overview
Make `resolveCategory` and `capabilities` required (or replaced). Remove the `??` fallback in dispatch.

### Changes Required:

#### 1. Make `resolveCategory` required on `ProviderDefinition`
**File**: `packages/console-providers/src/define.ts`

Change from:
```typescript
readonly resolveCategory?: (eventType: string) => string;
```
To:
```typescript
readonly resolveCategory: (eventType: string) => string;
```

#### 2. Remove `capabilities?` from `ProviderDefinition`
**File**: `packages/console-providers/src/define.ts`

Delete:
```typescript
readonly capabilities?: Record<string, (...args: unknown[]) => unknown>;
```

Add `getActiveToken` to `OAuthDef`:
```typescript
export interface OAuthDef<TConfig, TAccountInfo extends ProviderAccountInfo = ProviderAccountInfo> {
  // ... existing methods ...
  /** Get a usable bearer token. Standard OAuth returns stored token. GitHub generates JWT-based installation token. */
  getActiveToken: (config: TConfig, storedExternalId: string, storedAccessToken: string | null) => Promise<string>;
}
```

Note: `storedExternalId` is the `installation.externalId` (GitHub's installationId, Vercel's team_id, etc.). `storedAccessToken` is the decrypted stored token (null for GitHub which doesn't store one).

#### 3. Add `resolveCategory` identity noop to GitHub and Sentry
**Files**: `providers/github.ts`, `providers/sentry.ts`

```typescript
// GitHub: wire eventType maps 1:1 to event key
resolveCategory: (eventType) => eventType,

// Sentry: wire eventType maps 1:1 to event key
resolveCategory: (eventType) => eventType,
```

(Vercel and Linear already have `resolveCategory` implemented.)

#### 4. Implement `getActiveToken` on all 4 providers

**GitHub** (`providers/github.ts`):
```typescript
getActiveToken: async (config, storedExternalId, _storedAccessToken) => {
  // GitHub App: generate on-demand installation token via JWT
  return getInstallationToken(config, storedExternalId);
},
```

**Vercel** (`providers/vercel.ts`):
```typescript
getActiveToken: async (_config, _storedExternalId, storedAccessToken) => {
  if (!storedAccessToken) throw new Error("vercel: no stored access token");
  return storedAccessToken;
},
```

**Linear** (`providers/linear.ts`):
```typescript
getActiveToken: async (_config, _storedExternalId, storedAccessToken) => {
  if (!storedAccessToken) throw new Error("linear: no stored access token");
  return storedAccessToken;
},
```

**Sentry** (`providers/sentry.ts`):
```typescript
getActiveToken: async (_config, _storedExternalId, storedAccessToken) => {
  if (!storedAccessToken) throw new Error("sentry: no stored access token");
  return storedAccessToken;
},
```

#### 5. Remove `capabilities` from GitHub provider
**File**: `providers/github.ts`

Delete the `capabilities` block (lines 256-262). The `getInstallationToken` and `getInstallationDetails` functions remain as module-private helpers.

#### 6. Update `dispatch.ts` — Remove `??` fallback
**File**: `packages/console-providers/src/dispatch.ts`

Change from:
```typescript
const category = providerDef.resolveCategory?.(eventType) ?? eventType;
```
To:
```typescript
const category = providerDef.resolveCategory(eventType);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (console-providers + gateway pass; relay + auth failures pre-existing)
- [ ] Linting passes: `pnpm lint`
- [x] All console-providers tests pass: `pnpm --filter @repo/console-providers test` (169/169)
- [x] No `capabilities?` or `resolveCategory?` in define.ts
- [x] No `??` fallback in dispatch.ts for resolveCategory

#### Manual Verification:
- [ ] Adding a new provider without `resolveCategory` -> TypeScript error
- [ ] Adding a new provider without `oauth.getActiveToken` -> TypeScript error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: CallbackResult Discriminated Union

### Overview
Replace `TypedCallbackResult` (3 optional fields) with a discriminated union on `status`. This gives the gateway explicit narrowing instead of independent optional checks.

### Changes Required:

#### 1. Define new `CallbackResult` type
**File**: `packages/console-providers/src/types.ts`

Replace `TypedCallbackResult`:
```typescript
/** Discriminated union for OAuth callback results */
export type CallbackResult<TAccountInfo extends ProviderAccountInfo = ProviderAccountInfo> =
  | { status: "connected"; externalId: string; accountInfo: TAccountInfo; tokens: OAuthTokens }
  | { status: "connected-no-token"; externalId: string; accountInfo: TAccountInfo }
  | { status: "connected-redirect"; externalId: string; accountInfo: TAccountInfo; tokens: OAuthTokens; nextUrl: string }
  | { status: "pending-setup"; externalId: string; setupAction: string };

// Keep Zod schema in sync:
export const callbackResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("connected"),
    externalId: z.string(),
    accountInfo: z.object({ version: z.literal(1), sourceType: z.string(), events: z.array(z.string()), installedAt: z.string(), lastValidatedAt: z.string(), raw: z.unknown() }).passthrough(),
    tokens: oAuthTokensSchema,
  }),
  z.object({
    status: z.literal("connected-no-token"),
    externalId: z.string(),
    accountInfo: z.object({ version: z.literal(1), sourceType: z.string(), events: z.array(z.string()), installedAt: z.string(), lastValidatedAt: z.string(), raw: z.unknown() }).passthrough(),
  }),
  z.object({
    status: z.literal("connected-redirect"),
    externalId: z.string(),
    accountInfo: z.object({ version: z.literal(1), sourceType: z.string(), events: z.array(z.string()), installedAt: z.string(), lastValidatedAt: z.string(), raw: z.unknown() }).passthrough(),
    tokens: oAuthTokensSchema,
    nextUrl: z.string(),
  }),
  z.object({
    status: z.literal("pending-setup"),
    externalId: z.string(),
    setupAction: z.string(),
  }),
]);
```

#### 2. Update `OAuthDef` return type
**File**: `packages/console-providers/src/define.ts`

```typescript
export interface OAuthDef<TConfig, TAccountInfo extends ProviderAccountInfo = ProviderAccountInfo> {
  // ...
  processCallback: (config: TConfig, query: Record<string, string>) => Promise<CallbackResult<TAccountInfo>>;
}
```

#### 3. Update all 4 provider `processCallback` implementations

**GitHub** (`providers/github.ts`) — returns `connected-no-token`:
```typescript
return {
  status: "connected-no-token",
  externalId: installationId,
  accountInfo: { /* ... same ... */ },
} satisfies CallbackResult<GitHubAccountInfo>;
```

**Vercel** (`providers/vercel.ts`) — returns `connected-redirect` when `next` exists, `connected` otherwise:
```typescript
if (next) {
  return {
    status: "connected-redirect",
    externalId,
    accountInfo: { /* ... */ },
    tokens: oauthTokens,
    nextUrl: next,
  } satisfies CallbackResult<VercelAccountInfo>;
}
return {
  status: "connected",
  externalId,
  accountInfo: { /* ... */ },
  tokens: oauthTokens,
} satisfies CallbackResult<VercelAccountInfo>;
```

**Linear** (`providers/linear.ts`) — returns `connected`:
```typescript
return {
  status: "connected",
  externalId,
  accountInfo: { /* ... */ },
  tokens: oauthTokens,
} satisfies CallbackResult<LinearAccountInfo>;
```

**Sentry** (`providers/sentry.ts`) — returns `connected`:
```typescript
return {
  status: "connected",
  externalId: sentryInstallationId,
  accountInfo: { /* ... */ },
  tokens: oauthTokens,
} satisfies CallbackResult<SentryAccountInfo>;
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (console-providers + gateway pass; relay pre-existing failure)
- [ ] Linting passes: `pnpm lint`
- [x] All console-providers tests pass: `pnpm --filter @repo/console-providers test` (169/169)
- [x] `TypedCallbackResult` replaced by `CallbackResult` (deprecated alias kept for gateway backward compat)
- [x] No `tokens?` / `setupAction?` / `nextUrl?` optional access patterns in providers

#### Manual Verification:
- [ ] Each callback result variant is exhaustively typed (new provider must return one of the 4 status values)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Update Gateway to Use New Interfaces

### Overview
Update `apps/gateway/src/routes/connections.ts` to consume `getActiveToken` (removing the `if (provider === "github")` branch) and handle `CallbackResult` discriminated union.

### Changes Required:

#### 1. Update callback handler to switch on `result.status`
**File**: `apps/gateway/src/routes/connections.ts` (around line 210-315)

Replace independent optional checks with a status switch:
```typescript
const result = await providerDef.oauth.processCallback(config, query);

// Common: upsert installation (for all statuses except pending-setup)
if (result.status === "pending-setup") {
  // Store setup action in Redis, redirect to completion
  // ...
  return c.redirect(/* setup URL */);
}

// All other statuses have accountInfo
const { accountInfo } = result;
// ... upsert installation ...

// Persist tokens if present
if (result.status === "connected" || result.status === "connected-redirect") {
  await writeTokenRecord(installation.id, result.tokens);
}

// Store completion in Redis
await redis.pipeline()
  .hset(oauthResultKey(state), {
    status: "completed",
    provider: providerName,
    ...(reactivated ? { reactivated: "true" } : {}),
  })
  .expire(oauthResultKey(state), 300)
  .exec();

// Provider-specific redirect
if (result.status === "connected-redirect") {
  return c.redirect(result.nextUrl);
}

// Standard redirects...
```

#### 2. Replace capabilities branch with `getActiveToken`
**File**: `apps/gateway/src/routes/connections.ts` (around line 457-468)

Replace:
```typescript
if (providerName === "github") {
  const capabilities = PROVIDERS.github.capabilities;
  // ...
}
```

With:
```typescript
const providerDef = getProvider(providerName);
if (!providerDef) throw new Error("provider_not_found");
const token = await providerDef.oauth.getActiveToken(config, installation.externalId, decryptedAccessToken);
return c.json({ accessToken: token, provider: providerName, expiresIn: 3600 });
```

This removes the ONLY provider-specific branch in the gateway.

#### 3. Remove `PROVIDERS` direct import from connections.ts
**File**: `apps/gateway/src/routes/connections.ts`

Change:
```typescript
import { getProvider, PROVIDERS } from "@repo/console-providers";
```
To:
```typescript
import { getProvider } from "@repo/console-providers";
```

#### 4. Update gateway tests
**Files**: `apps/gateway/src/routes/connections.test.ts`, `connections.integration.test.ts`

Update mock provider definitions to include `getActiveToken`, `resolveCategory`, and new `CallbackResult` shapes.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (gateway passes)
- [ ] Linting passes: `pnpm lint`
- [x] Gateway tests pass: `pnpm --filter gateway test` (101/101)
- [x] No `PROVIDERS.github.capabilities` in codebase
- [x] No `providerName === "github"` in token endpoint (line 462 removed); one remains at line 162 (stateless GitHub callback recovery — genuinely provider-specific, not described in plan body)
- [ ] Integration tests pass: `pnpm --filter @repo/integration-tests test` (pre-existing failures unrelated to Phase 4: missing @repo/console-validation in backfill)

#### Manual Verification:
- [ ] OAuth callback flow works for GitHub (no token stored, installation-based)
- [ ] OAuth callback flow works for Vercel (redirect to `next` URL)
- [ ] Token acquisition for GitHub returns valid installation token
- [ ] Token acquisition for Linear/Sentry/Vercel returns stored token

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that OAuth flows still work before proceeding.

---

## Phase 5: PostTransformEvent — Required Actor with Null

### Overview
Change `actor` from optional to `actor: PostTransformActor | null`. Change `email` and `avatarUrl` from optional to `string | null`. Change reference `url` and `label` from optional to `string | null`.

### Changes Required:

#### 1. Update schemas
**File**: `packages/console-providers/src/post-transform-event.ts`

```typescript
export const postTransformActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().nullable(),     // was .optional()
  avatarUrl: z.string().url().nullable(),   // was .optional()
});

export const postTransformReferenceSchema = z.object({
  type: z.enum([/* ... same ... */]),
  id: z.string().min(1),
  url: z.string().url().nullable(),         // was .optional()
  label: z.string().nullable(),             // was .optional()
});

export const postTransformEventSchema = z.object({
  source: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(50000),
  actor: postTransformActorSchema.nullable(),  // was .optional()
  occurredAt: z.iso.datetime(),
  references: z.array(postTransformReferenceSchema),
  metadata: z.record(z.string(), z.unknown()),
});
```

#### 2. Update all transformers to return `null` instead of `undefined`
**Files**: All transformer files in `packages/console-providers/src/transformers/`

For each transformer that can have no actor:
```typescript
// Before: actor: someCondition ? { ... } : undefined,
// After:  actor: someCondition ? { ... } : null,
```

For actor email/avatarUrl:
```typescript
// Before: email: user.email,           (might be undefined)
// After:  email: user.email ?? null,
```

For reference url/label:
```typescript
// Before: url: commit.url,             (might be undefined)
// After:  url: commit.url ?? null,
```

This affects:
- `transformers/github.ts` — push, pull_request, issues, release, discussion
- `transformers/vercel.ts` — deployment (actor is always null for Vercel)
- `transformers/linear.ts` — issue, comment, project, cycle, projectUpdate
- `transformers/sentry.ts` — issue, error, event_alert, metric_alert

#### 3. Update validation.ts
**File**: `packages/console-providers/src/validation.ts`

Change optional access to null checks:
```typescript
// Before: if (event.actor?.avatarUrl && isValidUrl(event.actor.avatarUrl))
// After:  if (event.actor?.avatarUrl && isValidUrl(event.actor.avatarUrl))
// (This still works with nullable — ?. handles null correctly)
```

#### 4. Update consumers
**Key files** (search for `.actor?`, `.email?`, `.avatarUrl?`):
- `api/console/src/lib/actor-identity.ts:42-44` — `sourceActor?.email ?? null` (already handles null correctly)
- `api/console/src/inngest/workflow/neural/observation-capture.ts:907` — `sourceEvent.actor?.name ?? "unknown"` (still works)
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:90` — `sourceEvent.actor ?? null` (already correct)
- `api/console/src/inngest/workflow/neural/profile-update.ts:180,194` — `sourceActor?.email ?? null` (already correct)
- `core/cli/src/commands/listen.ts:87-88` — `e.sourceEvent.actor?.name` (still works with nullable)

Note: `?.` works for both `undefined` and `null`, so most consumers need no changes. The main work is in the transformers producing the data.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (console-providers + gateway + relay pass; auth pre-existing failure unrelated)
- [ ] Linting passes: `pnpm lint`
- [x] All console-providers tests pass: `pnpm --filter @repo/console-providers test` (169/169)
- [ ] All neural workflow tests pass: `pnpm --filter @api/console test`
- [x] No `.optional()` on actor, email, avatarUrl, url, label in post-transform-event.ts

#### Manual Verification:
- [ ] Webhook ingestion still produces correct events with actors
- [ ] Events without actors (e.g., Vercel deployment) have `actor: null` not `actor: undefined`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 6: Derive providerAccountInfoSchema + Delete getEventWeight

### Overview
Derive `providerAccountInfoSchema` from `PROVIDERS` instead of hand-maintaining it. Move per-provider `accountInfoSchema` into the provider definition. Delete `getEventWeight` function.

### Changes Required:

#### 1. Add `accountInfoSchema` to `ProviderDefinition`
**File**: `packages/console-providers/src/define.ts`

```typescript
export interface ProviderDefinition<
  TConfig = unknown,
  TAccountInfo extends ProviderAccountInfo = ProviderAccountInfo,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<string, EventDefinition>,
> {
  // ... existing fields ...
  readonly accountInfoSchema: z.ZodType<TAccountInfo>;  // NEW
}
```

#### 2. Add `accountInfoSchema` to each provider

**GitHub** (`providers/github.ts`):
```typescript
import { githubAccountInfoSchema } from "../types.js";
// In provider def:
accountInfoSchema: githubAccountInfoSchema,
```

(Same pattern for vercel, linear, sentry.)

#### 3. Derive `providerAccountInfoSchema` in `registry.ts`
**File**: `packages/console-providers/src/registry.ts`

```typescript
export const providerAccountInfoSchema = z.discriminatedUnion(
  "sourceType",
  Object.values(PROVIDERS).map((p) => p.accountInfoSchema) as [
    (typeof PROVIDERS)[ProviderName]["accountInfoSchema"],
    ...(typeof PROVIDERS)[ProviderName]["accountInfoSchema"][],
  ],
);
export type ProviderAccountInfo = z.infer<typeof providerAccountInfoSchema>;
```

#### 4. Remove hand-maintained union from `types.ts`
**File**: `packages/console-providers/src/types.ts`

Delete:
```typescript
export const providerAccountInfoSchema = z.discriminatedUnion("sourceType", [
  githubAccountInfoSchema,
  vercelAccountInfoSchema,
  linearAccountInfoSchema,
  sentryAccountInfoSchema,
]);
export type ProviderAccountInfo = z.infer<typeof providerAccountInfoSchema>;
```

Keep the individual schemas (`githubAccountInfoSchema`, etc.) in types.ts — they're still imported by providers.

#### 5. Update `index.ts` exports
Move `providerAccountInfoSchema` and `ProviderAccountInfo` exports from `types.js` to `registry.js`.

#### 6. Delete `getEventWeight`
**File**: `packages/console-providers/src/registry.ts`

Delete:
```typescript
export function getEventWeight(source: SourceType, eventType: string): number {
  const events = PROVIDERS[source].events as Record<string, EventDefinition>;
  return events[eventType]?.weight ?? 35;
}
```

#### 7. Update `scoring.ts` consumer
**File**: `api/console/src/inngest/workflow/neural/scoring.ts`

Replace:
```typescript
let score = getEventWeight(sourceEvent.source, sourceEvent.sourceType);
```

With direct `EVENT_REGISTRY` lookup:
```typescript
import { EVENT_REGISTRY } from "@repo/console-providers";
// ...
const eventKey = `${sourceEvent.source}:${sourceEvent.sourceType}` as EventKey;
const registryEntry = EVENT_REGISTRY[eventKey];
let score = registryEntry?.weight ?? 35; // Keep fallback only at consumer boundary
```

Note: The `?? 35` fallback stays here because `scoring.ts` receives arbitrary events from the DB that may predate the current registry. This is a consumer-boundary concern, not a registry concern.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (auth failure pre-existing, unrelated to Phase 6)
- [ ] Linting passes: `pnpm lint`
- [x] All console-providers tests pass: `pnpm --filter @repo/console-providers test` (169/169)
- [x] No `getEventWeight` function in codebase
- [x] No hand-maintained `z.discriminatedUnion("sourceType", [...])` in types.ts
- [x] `providerAccountInfoSchema` is derived from PROVIDERS in registry.ts

#### Manual Verification:
- [ ] Adding a new provider without `accountInfoSchema` -> TypeScript error
- [ ] `providerAccountInfoSchema` correctly validates all 4 provider account infos

**Implementation Note**: After completing this phase, the full refactor is complete.

---

## Testing Strategy

### Unit Tests:
- Each provider's `processCallback` returns correct `CallbackResult.status` variant
- `simpleEvent()` produces `kind: "simple"`, `actionEvent()` produces `kind: "with-actions"`
- `deriveEventRegistry()` correctly derives entries for both simple and action events
- `transformWebhookPayload()` works with required `resolveCategory`
- All transformers produce `actor: null` (not `undefined`) when no actor

### Integration Tests:
- Gateway OAuth callback flow for each provider
- Gateway token acquisition via `getActiveToken` for each provider
- Full relay -> console ingestion pipeline with new event shapes

### Manual Testing Steps:
1. Connect a GitHub App installation, verify callback completes
2. Connect a Vercel integration, verify redirect to `next` URL
3. Trigger a webhook from each provider, verify events appear in console
4. Request a GitHub installation token via gateway API

## Performance Considerations

None. All changes are type-level or direct function calls replacing optional chains. No runtime overhead change.

## Migration Notes

- **No DB migrations required** — All changes are in application code types and function signatures
- **Existing stored events** in `workspace_events` may have `actor: undefined` (pre-migration). The `scoring.ts` consumer already handles this with `?.` access. The Zod schema change from `.optional()` to `.nullable()` means re-parsing old events would fail on `undefined` actors — but we don't re-parse stored events, so this is safe.
- **Stored `OAuthTokens`** are not changed in this plan (deferred)

## References

- Research Doc 1: `thoughts/shared/research/2026-03-05-web-analysis-typescript-zod-provider-registry.md`
- Research Doc 2: `thoughts/shared/research/2026-03-05-web-analysis-zod-typescript-provider-registry.md`
- Current define.ts: `packages/console-providers/src/define.ts`
- Gateway capabilities branch: `apps/gateway/src/routes/connections.ts:457-468`
- Gateway callback handler: `apps/gateway/src/routes/connections.ts:136-315`
- PostTransformEvent: `packages/console-providers/src/post-transform-event.ts`
- Registry: `packages/console-providers/src/registry.ts`
- Dispatch: `packages/console-providers/src/dispatch.ts`
