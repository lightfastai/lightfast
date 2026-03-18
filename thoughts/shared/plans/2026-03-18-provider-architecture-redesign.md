# Provider Architecture Redesign — Implementation Plan

## Overview

Implement 9 targeted changes to the `console-providers` package that achieve tRPC-level type safety, Zod-first signature verification, a 3-tier provider model (`WebhookProvider | ManagedProvider | ApiProvider`), universal connection health monitoring, and 1-touch provider addition. Based on the synthesis at `thoughts/shared/research/2026-03-18-provider-architecture-synthesis.md`.

## Current State Analysis

The provider system (`packages/console-providers/src/`) has a 2-tier discriminated union (`WebhookProvider | ApiProvider`) with five providers (apollo, github, linear, sentry, vercel). The system works but has structural gaps that make adding providers a multi-file ordeal and mistype GitHub's auth semantics.

### Key Discoveries:
- `define.ts:503` — `WebhookProvider.auth` hardcoded to `OAuthDef` only; GitHub is structurally an App Token provider using OAuth as a workaround
- `define.ts:554-558` — `WebhookProvider.classifier` and `WebhookProvider.lifecycle` are required but **never consumed** at runtime — dead code across all apps (relay, gateway, backfill); `connectionLifecycleWorkflow` referenced in comments does not exist
- `registry.ts:22-28` — `ProviderConfigMap` must be manually updated alongside `PROVIDERS`
- `registry.ts:136-155` — Two manual `z.discriminatedUnion` tuples must be updated per provider
- `display.ts:18-67` — 89-line static object, separate from provider definitions, must be kept in sync
- `relay/src/middleware/webhook.ts:65-82` — `webhookSecretEnvKey` manual map, separate from provider definitions
- `gateway.ts` — 222 lines mixing 4 distinct cross-service contracts
- No `signatureScheme` field exists — each provider implements `verifySignature` independently
- No `client-registry.ts`, `wire.ts`, or `backfill-contracts.ts` exist yet
- `IconDef` schema exists in `define.ts:731-735` but is not referenced by any provider interface
- All 4 webhook providers (github, linear, sentry, vercel) use HMAC-SHA256 or HMAC-SHA1 with the same `computeHmac` + `timingSafeEqual` pattern

## Desired End State

After all 9 changes:
- Adding a provider is a **1-touch operation** (add to `PROVIDERS` only)
- `PROVIDERS.github.auth` has type `AppTokenDef`, not `OAuthDef`
- `LifecycleDef`, `EventClassifier`, and `LifecycleReason` are deleted — replaced by universal `HealthCheckDef`
- `HealthCheckDef` on `BaseProviderFields` (optional) enables 401-poll connection health monitoring across all provider tiers
- Signature schemes are pure Zod data — relay derives secrets from provider definitions
- `ManagedProvider` tier exists for programmatic webhook registration (Clerk, PostHog, Stripe)
- Display metadata lives on provider definitions — no separate `display.ts` to maintain
- `gateway.ts` is split into single-consumer contract files
- `ClientShape<P>` enforces bundle safety at the type level

### Verification:
```bash
pnpm typecheck         # zero errors across all apps
pnpm check             # zero lint errors
pnpm --filter @repo/console-providers test   # all tests pass
```

## What We're NOT Doing

- **`PollingDef`** — continuous scheduled pull for PostHog/Amplitude (requires polling worker service)
- **`WebhookCapability` on `ApiProvider`** — webhook reception for API-key providers without programmatic registration
- **Category ↔ BackfillEntityType unification** — deferred to future research
- **Typed payload pipeline** — `payload: z.unknown()` → typed end-to-end (high-impact but requires typed `WebhookEnvelope` variants)
- **Relay auto-registration factory** — `createWebhookRouter(PROVIDERS)` (deferred)
- **Provider telemetry schema** — structured `TelemetryEvent` (deferred)
- **`StreamingDef`** — Salesforce CDC, Kafka-style providers (future primitive)
- **Database schema changes beyond `webhookSetupState`** — no other schema changes needed
- **Changing `BackfillDef`, `ResourcePickerDef`, or `ProviderApi` structures** — already correct
- **Ed25519 signature scheme** — no current provider uses ed25519; requires `@noble/ed25519` and a real `deriveVerifySignature` implementation; deferred until a concrete provider (e.g., Svix-based) needs it
- **Classifier-based event routing** — `EventClassifier` ("lifecycle" | "data" | "unknown") was dead code and is deleted in Phase 2; future DLQ/routing logic can be re-introduced when the relay actually needs it
- **HealthCheck implementations** — Phase 2 defines the `HealthCheckDef` interface only; per-provider implementations (API calls, 401 detection) are a follow-up task
- **Webhook-based lifecycle detection** — the old model (GitHub `installation.deleted`, Vercel `integration-configuration.removed`) is replaced by simple 401-poll health checks; providers that send lifecycle-type webhooks still receive them as data events

## Implementation Approach

Changes are ordered by dependency. Phases 1-3 are sequential (each builds on the previous). Phases 4-6 and 8 are largely independent and can be done in any order after Phase 3. Phase 7 requires both Phase 3 (relay uses `deriveVerifySignature`) **and** Phase 9's `hasInboundWebhooks` type guard before the relay guard is correct. Phase 9 depends on Phase 3.

**Type-safety principle**: Test type-level assertions inside `console-providers` at each phase boundary before touching any consumer (relay, gateway, backfill, console). The provider package must surface the correct narrow types so consumers never need type casts.

---

## Phase 1: AppTokenDef + Auth Widening

### Overview
Fix GitHub's auth semantics by introducing `AppTokenDef` as a third auth strategy. Widen `WebhookProvider.auth` to accept both `OAuthDef` and `AppTokenDef`. Migrate GitHub from fake OAuth to real App Token auth.

### Changes Required:

#### 1. New `AppTokenDef` interface
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add `AppTokenDef` interface after `ApiKeyDef` (~line 164). Update `AuthDef` union to include it. Add `isAppTokenAuth` type guard.

```typescript
/**
 * App-token auth — provider uses app-level credentials (private key, app ID)
 * to generate per-installation tokens on demand. No token is stored.
 * Examples: GitHub App (RS256 JWT → installation access token).
 */
export interface AppTokenDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> {
  readonly kind: "app-token";
  readonly buildInstallUrl: (
    config: TConfig,
    state: string,
    options?: Record<string, unknown>
  ) => string;
  readonly processCallback: (
    config: TConfig,
    query: Record<string, string>
  ) => Promise<CallbackResult<TAccountInfo>>;
  readonly getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: null
  ) => Promise<string>;
  readonly getAppToken?: (config: TConfig) => Promise<string>;
  readonly buildAuthHeader?: (token: string) => string;
  readonly revokeAccess?: (config: TConfig, externalId: string) => Promise<void>;
  readonly usesStoredToken: false;
}

export type AuthDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> =
  | OAuthDef<TConfig, TAccountInfo>
  | ApiKeyDef<TConfig, TAccountInfo>
  | AppTokenDef<TConfig, TAccountInfo>;

export function isAppTokenAuth<TConfig>(
  auth: AuthDef<TConfig>
): auth is AppTokenDef<TConfig> {
  return auth.kind === "app-token";
}
```

#### 2. Widen `WebhookProvider.auth`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Change `WebhookProvider.auth` at line 503 from `OAuthDef<TConfig, TAccountInfo>` to `OAuthDef<TConfig, TAccountInfo> | AppTokenDef<TConfig, TAccountInfo>`.

```typescript
// Before:
readonly auth: OAuthDef<TConfig, TAccountInfo>;

// After:
readonly auth: OAuthDef<TConfig, TAccountInfo> | AppTokenDef<TConfig, TAccountInfo>;
```

#### 3. Migrate GitHub auth block
**File**: `packages/console-providers/src/providers/github/index.ts`
**Changes**: Rewrite the `auth` block (lines 155-256) from `kind: "oauth"` to `kind: "app-token"`. Remove dead `exchangeCode` and `refreshToken`. Rename `buildAuthUrl` → `buildInstallUrl`. Keep `processCallback` and `getActiveToken` logic unchanged. Add `getAppToken` and `revokeAccess`.

```typescript
auth: {
  kind: "app-token" as const,
  buildInstallUrl: (config, state) => {
    const url = new URL(`https://github.com/apps/${config.appSlug}/installations/new`);
    url.searchParams.set("state", state);
    return url.toString();
  },
  processCallback: (_config, query) => {
    // existing guard logic preserved — extracts installation_id from query
    const installationId = query.installation_id;
    // ... (existing validation unchanged)
    return Promise.resolve({
      status: "connected-no-token",
      externalId: installationId,
      accountInfo: { /* existing shape */ },
    } satisfies CallbackResult<GitHubAccountInfo>);
  },
  getActiveToken: async (config, storedExternalId, _storedAccessToken) => {
    return getInstallationToken(config, storedExternalId);
  },
  getAppToken: async (config) => createGitHubAppJWT(config),
  revokeAccess: async (config, externalId) => {
    // move existing revokeToken logic, adapted for app-token semantics
  },
  usesStoredToken: false as const,
},
```

#### 4. Update gateway callback handler
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Update the `auth.kind !== "oauth"` guard (line 121 in authorize, line 262 in callback) to also accept `"app-token"`. For authorize: `AppTokenDef` uses `buildInstallUrl` instead of `buildAuthUrl`. For callback: both `OAuthDef` and `AppTokenDef` have `processCallback`.

```typescript
// Authorize handler — branch on auth.kind:
if (auth.kind === "oauth") {
  const authUrl = auth.buildAuthUrl(providerConfig, state);
  // ... existing OAuth flow
} else if (auth.kind === "app-token") {
  const installUrl = auth.buildInstallUrl(providerConfig, state);
  // ... redirect to install URL
} else {
  return c.json({ error: "not_callback_provider" }, 400);
}

// Callback handler — both OAuth and app-token have processCallback:
if (auth.kind !== "oauth" && auth.kind !== "app-token") {
  return c.json({ error: "not_callback_provider" }, 400);
}
// TypeScript narrows to OAuthDef | AppTokenDef — safe to call processCallback
```

Also update the token helper functions at lines ~570 and ~628 where `auth.kind !== "oauth"` guards `refreshToken` calls — `AppTokenDef` has no `refreshToken`, so the guard should remain but the error path should be adjusted to regenerate via `getActiveToken` instead.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] All tests pass: `pnpm --filter @repo/console-providers test`
- [x] Type assertion: `(typeof PROVIDERS)["github"]["auth"]["kind"]` resolves to `"app-token"`
- [x] Type assertion: `(typeof PROVIDERS)["github"]["auth"]["usesStoredToken"]` resolves to `false`

#### Manual Verification:
- [ ] GitHub App installation flow still works end-to-end (install → callback → token generation)
- [ ] Existing GitHub connections continue to function (getActiveToken produces valid installation tokens)
- [ ] Gateway authorize/callback routes handle both OAuth and app-token providers correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the GitHub App flow works before proceeding.

---

## Phase 2: Drop Lifecycle + Classifier, Add HealthCheckDef

### Overview
Delete the dead `LifecycleDef`, `LifecycleReason`, and `EventClassifier` system entirely. Neither `classifier.classify()` nor `lifecycle.events[...]()` is called anywhere at runtime — no `connectionLifecycleWorkflow` exists. Replace with a universal `HealthCheckDef` on `BaseProviderFields` (optional) that enables simple 401-poll connection health monitoring across **all** provider tiers (webhook, managed, API). Health check implementations on individual providers are deferred — this phase defines the interface only.

### Changes Required:

#### 1. Add `ConnectionStatus` schema and `HealthCheckDef` interface
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add after the `AuthDef` union (replacing the `EventClassifier` and `LifecycleDef` sections):

```typescript
// ── Connection Health ────────────────────────────────────────────────────────

export const connectionStatusSchema = z.enum(["healthy", "revoked", "suspended"]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/**
 * Universal connection health probe — lives on BaseProviderFields (optional).
 * Called by a cron job to detect 401/revoked/suspended connections.
 * Returns "healthy" when the connection is working, or the failure reason.
 *
 * Providers without a meaningful liveness endpoint (e.g., Apollo API keys that
 * don't expire) omit this field — the polling cron skips them.
 */
export interface HealthCheckDef<TConfig> {
  readonly check: (
    config: TConfig,
    externalId: string,
    accessToken: string | null
  ) => Promise<ConnectionStatus>;
}
```

#### 2. Delete `EventClassifier` interface
**File**: `packages/console-providers/src/define.ts`
**Changes**: Delete the entire `EventClassifier` section — the section comment (`// ── Event Classifier`), JSDoc, and the `EventClassifier` interface (lines ~210-227).

#### 3. Delete `LifecycleDef` interface and `LifecycleReason` type
**File**: `packages/console-providers/src/define.ts`
**Changes**: Delete the entire `LifecycleDef` section — the section comment (`// ── Lifecycle Def`), `LifecycleReason` type, JSDoc, and `LifecycleDef` interface (lines ~229-250).

#### 4. Add `healthCheck` to `BaseProviderFields`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add optional field to `BaseProviderFields` (alongside other optional fields like `edgeRules`, `optional`):

```typescript
/** Optional connection health probe — enables 401-poll cron for revocation detection */
readonly healthCheck?: HealthCheckDef<TConfig>;
```

#### 5. Remove `classifier` and `lifecycle` from `WebhookProvider`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Delete both fields from the `WebhookProvider` interface:
- Delete `readonly classifier: EventClassifier;` (line ~554)
- Delete `readonly lifecycle: LifecycleDef;` (line ~558)
- Delete associated JSDoc comments for both fields

#### 6. Delete classifier and lifecycle blocks from all 4 webhook providers

**GitHub** (`packages/console-providers/src/providers/github/index.ts`):
- Delete entire `classifier` block (~lines 226-243)
- Delete entire `lifecycle` block (~lines 245-276)

**Linear** (`packages/console-providers/src/providers/linear/index.ts`):
- Delete entire `classifier` block (~lines 397-413)
- Delete `lifecycle: { events: {} }` block (~lines 416-418)

**Sentry** (`packages/console-providers/src/providers/sentry/index.ts`):
- Delete entire `classifier` block (~lines 268-282)
- Delete entire `lifecycle` block (~lines 284-293)

**Vercel** (`packages/console-providers/src/providers/vercel/index.ts`):
- Delete entire `classifier` block (~lines 283-296)
- Delete entire `lifecycle` block (~lines 298-312)

#### 7. Update exports
**File**: `packages/console-providers/src/index.ts`
**Changes**:
- Remove exports: `LifecycleDef`, `LifecycleReason` (and `EventClassifier` if exported)
- Add exports: `HealthCheckDef`, `ConnectionStatus`, `connectionStatusSchema`

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] All tests pass: `pnpm --filter @repo/console-providers test`
- [x] Type assertion: `WebhookProvider` no longer has `classifier` or `lifecycle` fields
- [x] Type assertion: `"lifecycle" in PROVIDERS.github` is `false`
- [x] Type assertion: `"classifier" in PROVIDERS.github` is `false`
- [x] Type assertion: `HealthCheckDef` is accessible via `BaseProviderFields` (optional)
- [x] Runtime validation: `connectionStatusSchema.parse("healthy")` succeeds
- [x] Runtime validation: `connectionStatusSchema.parse("revoked")` succeeds
- [x] Runtime validation: `connectionStatusSchema.parse("suspended")` succeeds
- [x] No consumer (relay, gateway, backfill, console API) imports `LifecycleDef`, `LifecycleReason`, or `EventClassifier`

#### Manual Verification:
- [ ] All 4 webhook providers still process data webhooks correctly (lifecycle/classifier removal doesn't affect data flow — they were never consumed)
- [ ] No runtime errors in relay webhook processing

**Implementation Note**: Health check implementations on individual providers are deferred to a follow-up task. This phase defines the interface and removes dead code only. After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: SignatureScheme — Zod-First Innovation

### Overview
Add `SignatureScheme` as a pure Zod data declaration on `WebhookDef`. Implement `deriveVerifySignature` to auto-generate verification from the scheme. Add `signatureScheme` to all 4 webhook providers and remove their manual `verifySignature` implementations (except where non-standard).

### Changes Required:

#### 1. Add Zod signature scheme schemas
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add after the existing imports/schemas (before `WebhookDef`). HMAC only — ed25519 is deferred (see "What We're NOT Doing"):

```typescript
// ── Signature Schemes (ZOD-FIRST — pure data, no functions) ─────────────────
// Only HMAC is implemented. Ed25519 is deferred until a concrete provider needs it.

export const hmacSchemeSchema = z.object({
  kind: z.literal("hmac"),
  algorithm: z.enum(["sha256", "sha1", "sha512"]),
  encoding: z.enum(["hex", "base64"]),
  signatureHeader: z.string(),
  prefix: z.string().optional(),
});

export const signatureSchemeSchema = hmacSchemeSchema;

export type SignatureScheme = z.infer<typeof signatureSchemeSchema>;
export type HmacScheme = SignatureScheme;

export const hmac = (opts: Omit<HmacScheme, "kind">): HmacScheme => ({
  kind: "hmac",
  ...opts,
});
```

#### 2. Add `signatureScheme` to `WebhookDef`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add `signatureScheme` field to `WebhookDef` interface (lines 79-96). Make `verifySignature` optional (providers can override the derived default).

```typescript
export interface WebhookDef<TConfig> {
  readonly signatureScheme: SignatureScheme;
  readonly verifySignature?: (
    rawBody: string,
    headers: Headers,
    secret: string
  ) => boolean;
  // ... existing fields unchanged
}
```

#### 3. Add `deriveVerifySignature` utility
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add after the `WebhookDef` interface:

```typescript
export function deriveVerifySignature(
  scheme: SignatureScheme
): (rawBody: string, headers: Headers, secret: string) => boolean {
  // SignatureScheme is HMAC-only. The exhaustive branch below satisfies TypeScript
  // without a fallthrough `return false` that would silently pass unimplemented schemes.
  return (rawBody, headers, secret) => {
    const rawSig = headers.get(scheme.signatureHeader);
    if (!rawSig) return false;
    const received = scheme.prefix ? rawSig.slice(scheme.prefix.length) : rawSig;
    const algo = scheme.algorithm === "sha256" ? "SHA-256"
      : scheme.algorithm === "sha1"   ? "SHA-1"
      : "SHA-512";
    const expected = computeHmac(rawBody, secret, algo);
    return timingSafeEqual(received, expected);
  };
}
```

#### 4. Add `signatureScheme` to all 4 webhook providers

**GitHub** (`providers/github/index.ts`): Add `signatureScheme`, delete `verifySignature`:
```typescript
signatureScheme: hmac({
  algorithm: "sha256",
  encoding: "hex",
  signatureHeader: "x-hub-signature-256",
  prefix: "sha256=",
}),
// DELETE verifySignature — derived automatically
```

**Linear** (`providers/linear/index.ts`): Add `signatureScheme`, delete `verifySignature`:
```typescript
signatureScheme: hmac({
  algorithm: "sha256",
  encoding: "hex",
  signatureHeader: "linear-signature",
}),
// DELETE verifySignature
```

**Sentry** (`providers/sentry/index.ts`): Add `signatureScheme`, delete `verifySignature`:
```typescript
signatureScheme: hmac({
  algorithm: "sha256",
  encoding: "hex",
  signatureHeader: "sentry-hook-signature",
}),
// DELETE verifySignature
```

**Vercel** (`providers/vercel/index.ts`): Add `signatureScheme`, delete `verifySignature`:
```typescript
signatureScheme: hmac({
  algorithm: "sha1",
  encoding: "hex",
  signatureHeader: "x-vercel-signature",
}),
// DELETE verifySignature
```

#### 5. Update relay signature verification
**File**: `apps/relay/src/middleware/webhook.ts`
**Changes**: In the `signatureVerify` middleware (~line 242), use the derived or provided implementation:

```typescript
// Before:
const verified = providerDef.webhook.verifySignature(rawBody, c.req.raw.headers, secret);

// After:
const verify = providerDef.webhook.verifySignature
  ?? deriveVerifySignature(providerDef.webhook.signatureScheme);
const verified = verify(rawBody, c.req.raw.headers, secret);
```

Import `deriveVerifySignature` from `@repo/console-providers`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] Runtime validation: `signatureSchemeSchema.parse(PROVIDERS.github.webhook.signatureScheme)` succeeds
- [ ] Runtime validation: `signatureSchemeSchema.parse(PROVIDERS.vercel.webhook.signatureScheme)` succeeds
- [ ] Runtime validation: all 4 webhook providers' `signatureScheme` fields parse cleanly

#### Manual Verification:
- [ ] GitHub webhook signature verification still works (send test webhook via ngrok)
- [ ] Linear webhook signature verification still works
- [ ] Sentry webhook signature verification still works
- [ ] Vercel webhook signature verification still works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that all webhook signature verification still works.

---

## Phase 4: Display Consolidation + Icon Field

### Overview
Move `icon` and `comingSoon` into `BaseProviderFields`. Add icon data to each provider definition. **Do not rewrite `display.ts` here** — Phase 8's `PROVIDER_CLIENT_REGISTRY` supersedes it and will handle the `display.ts` rewrite. This phase's only job is making provider definitions the single source of truth for icon data.

### Changes Required:

#### 1. Add `icon` and `comingSoon` to `BaseProviderFields`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add two fields to `BaseProviderFields` (~line 428-476):

```typescript
readonly icon: IconDef;
readonly comingSoon?: true;
```

#### 2. Add icon data to each provider
**Files**: All 5 provider `index.ts` files.
**Changes**: Copy SVG path data from `display.ts` into each provider's definition object. Add `comingSoon: true as const` for apollo, vercel, linear, sentry.

Note: `display.ts` continues to exist unchanged after this phase. It is not updated here — Phase 8 will replace it entirely with a derived layer from `PROVIDER_CLIENT_REGISTRY`. The SVG data will be duplicated in both places until Phase 8 completes.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] TypeScript error if any provider definition is missing `icon` field
- [ ] `PROVIDERS.github.icon` resolves to an `IconDef` at the type level

#### Manual Verification:
- [ ] Console UI provider list still renders correctly (display.ts unchanged, no regression)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 5: Registry 1-Touch — Remove ProviderConfigMap + Auto-Derive Unions

### Overview
Remove the manual `ProviderConfigMap` interface. Auto-derive `providerAccountInfoSchema` and `providerConfigSchema` from `PROVIDERS`. Adding a provider becomes a 1-touch operation.

### Changes Required:

#### 1. Remove `ProviderConfigMap` and simplify `PROVIDERS`
**File**: `packages/console-providers/src/registry.ts`
**Changes**: Delete `ProviderConfigMap` interface (lines 22-28). Simplify `PROVIDERS` constraint:

```typescript
// Before:
interface ProviderConfigMap { ... }
export const PROVIDERS = { ... } as const satisfies {
  readonly [K in keyof ProviderConfigMap]: ProviderDefinition<ProviderConfigMap[K]>;
};

// After:
export const PROVIDERS = {
  apollo, github, vercel, linear, sentry,
} as const;
```

The `as const satisfies` constraint is removed because the factory functions (`defineWebhookProvider`, `defineApiProvider`) already enforce type correctness at each provider's call site. The `as const` preserves narrow types for `getProvider`.

#### 2. Auto-derive discriminated unions
**File**: `packages/console-providers/src/registry.ts`
**Changes**: Replace manual tuples (lines 136-155) with derived arrays:

```typescript
function makeDiscriminatedUnion<
  TKey extends string,
  T extends z.ZodDiscriminatedUnionOption<TKey>,
>(key: TKey, schemas: [T, ...T[]]) {
  return z.discriminatedUnion(key, schemas);
}

const _accountInfoSchemas = Object.values(PROVIDERS).map(
  (p) => p.accountInfoSchema
) as [
  (typeof PROVIDERS)[keyof typeof PROVIDERS]["accountInfoSchema"],
  ...(typeof PROVIDERS)[keyof typeof PROVIDERS]["accountInfoSchema"][],
];
export const providerAccountInfoSchema = makeDiscriminatedUnion(
  "sourceType",
  _accountInfoSchemas
);

const _configSchemas = Object.values(PROVIDERS).map(
  (p) => p.providerConfigSchema
) as [
  (typeof PROVIDERS)[keyof typeof PROVIDERS]["providerConfigSchema"],
  ...(typeof PROVIDERS)[keyof typeof PROVIDERS]["providerConfigSchema"][],
];
export const providerConfigSchema = makeDiscriminatedUnion(
  "provider",
  _configSchemas
);
```

#### 3. Remove config type imports
**File**: `packages/console-providers/src/registry.ts`
**Changes**: Delete the config type imports that were only used by `ProviderConfigMap` (lines 7-16, the `ApolloConfig`, `GitHubConfig`, etc. imports).

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] `ProviderAccountInfo` inferred type still includes all 5 provider account info variants
- [ ] `ProviderConfig` inferred type still includes all 5 provider config variants

#### Manual Verification:
- [ ] Adding a hypothetical 6th provider requires only adding it to `PROVIDERS` — no other files need manual updates (verify by code inspection)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation.

---

## Phase 6: Gateway.ts Split — One Contract Per File

### Overview
Split the 222-line `gateway.ts` into 3 focused files, each with a single consumer. Re-export from `index.ts` for zero breaking changes.

### Changes Required:

#### 1. Create `wire.ts`
**File**: `packages/console-providers/src/wire.ts` (new)
**Contents**: Move from `gateway.ts`:
- `serviceAuthWebhookBodySchema` + `ServiceAuthWebhookBody`
- `webhookReceiptPayloadSchema` + `WebhookReceiptPayload`
- `webhookEnvelopeSchema` + `WebhookEnvelope`

#### 2. Create `backfill-contracts.ts`
**File**: `packages/console-providers/src/backfill-contracts.ts` (new)
**Contents**: Move from `gateway.ts`:
- `backfillDepthSchema`
- `gwInstallationBackfillConfigSchema` + `GwInstallationBackfillConfig`
- `BACKFILL_DEPTH_OPTIONS`
- `backfillRunStatusSchema` (internal)
- `backfillTerminalStatusSchema` + `BACKFILL_TERMINAL_STATUSES`
- `backfillTriggerPayload` + `BackfillTriggerPayload`
- `backfillEstimatePayload` + `BackfillEstimatePayload`
- `backfillRunRecord` + `BackfillRunRecord`
- `backfillRunReadRecord` + `BackfillRunReadRecord`

#### 3. Trim `gateway.ts`
**File**: `packages/console-providers/src/gateway.ts`
**Contents**: Keep only:
- `gatewayConnectionSchema` + `GatewayConnection`
- `gatewayTokenResultSchema` + `GatewayTokenResult`
- `proxyExecuteRequestSchema` + `ProxyExecuteRequest`
- `proxyExecuteResponseSchema` + `ProxyExecuteResponse`
- `proxyEndpointsResponseSchema` + `ProxyEndpointsResponse`

#### 4. Update `index.ts` barrel
**File**: `packages/console-providers/src/index.ts`
**Changes**: Add re-exports from `wire.ts` and `backfill-contracts.ts`. Keep existing `gateway.ts` re-exports. Zero breaking changes for external consumers.

#### 5. Update internal imports
**Files**: Update imports in consuming apps to use the specific file when possible:
- `apps/relay/src/middleware/webhook.ts` — import from `wire.ts` instead of `gateway.ts`
- `apps/backfill/src/routes/trigger.ts` — import from `backfill-contracts.ts`
- `apps/backfill/src/routes/estimate.ts` — import from `backfill-contracts.ts`
- `apps/backfill/src/inngest/client.ts` — import from `backfill-contracts.ts`
- `apps/gateway/src/routes/connections.ts` — import from `gateway.ts` (already correct) and `backfill-contracts.ts`
- `api/console/src/router/org/connections.ts` — import from `backfill-contracts.ts`
- `packages/gateway-service-clients/src/gateway.ts` — import from `gateway.ts` (already correct)

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass across all apps: `pnpm --filter @repo/console-providers test`
- [ ] No import of `gateway.ts` that should point to `wire.ts` or `backfill-contracts.ts`

#### Manual Verification:
- [ ] Relay still processes webhooks correctly
- [ ] Backfill triggers still work
- [ ] Gateway connections API still responds correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation.

---

## Phase 7: Relay Config Threading — Eliminate Manual Secret Map

### Overview
Delete the `webhookSecretEnvKey` manual map. The relay resolves secrets on demand via `providerDef.webhook.extractSecret(providerConfig)` at request time — not at startup. **Depends on Phase 3** (SignatureScheme for `deriveVerifySignature`) **and Phase 9** (`hasInboundWebhooks` type guard must exist before Phase 7's relay guard is complete).

**Why not startup-time config building**: Building all provider configs eagerly at startup would crash the relay if any provider's env var is missing — even providers not relevant to a given deployment. Per-request lazy resolution is resilient to partial configurations.

### Changes Required:

#### 1. Update signature verification middleware
**File**: `apps/relay/src/middleware/webhook.ts`
**Changes**: Delete `webhookSecretEnvKey` map (lines 65-82). Replace with per-request provider config resolution:

```typescript
// Before:
const secretEnvKey = webhookSecretEnvKey[providerName];
const secret = secretEnvKey ? env[secretEnvKey] : undefined;

// After:
const runtime = { callbackBaseUrl: env.RELAY_BASE_URL };
const providerConfig = providerDef.createConfig(
  env as unknown as Record<string, string>,
  runtime
);
if (!providerConfig) return c.json({ error: "provider_not_configured" }, 500);
const secret = providerDef.webhook.extractSecret(providerConfig);
```

Update verification to use derived or provided implementation (from Phase 3):
```typescript
const verify = providerDef.webhook.verifySignature
  ?? deriveVerifySignature(providerDef.webhook.signatureScheme);
const verified = verify(rawBody, c.req.raw.headers, secret);
```

#### 2. Update relay provider guard
**File**: `apps/relay/src/middleware/webhook.ts`
**Changes**: The existing guard (`isWebhookProvider`) must be updated to `hasInboundWebhooks` — this type guard is defined in Phase 9. Do this update as part of Phase 7 only if Phase 9 is already complete; otherwise, complete Phase 9 first and update the guard there.

#### 3. Verify relay environment schema unchanged
**File**: `apps/relay/src/env.ts`
**Changes**: None needed. The individual webhook secret env vars (`GITHUB_WEBHOOK_SECRET`, `LINEAR_WEBHOOK_SIGNING_SECRET`, etc.) are still read by `createConfig()` on each provider — the relay just no longer needs a separate manual map pointing to them.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] `webhookSecretEnvKey` map no longer exists in the codebase

#### Manual Verification:
- [ ] All 4 webhook providers' signatures verify correctly via relay (test with ngrok + real webhooks)
- [ ] Adding a new webhook provider to `PROVIDERS` automatically works in relay without relay code changes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that webhook verification works.

---

## Phase 8: ClientShape + PROVIDER_CLIENT_REGISTRY

### Overview
Create a `ClientShape<P>` utility type that extracts only pure-data fields from a provider definition. Build `PROVIDER_CLIENT_REGISTRY` as the UI layer's import target, enforcing bundle safety at the type level.

### Changes Required:

#### 1. Add `ClientShape` type and `extractClientShape` function
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add near the end of the file:

```typescript
export type ClientShape<P extends ProviderDefinition> = {
  readonly name: P["name"];
  readonly displayName: P["displayName"];
  readonly description: P["description"];
  readonly icon: P["icon"];
  readonly comingSoon: P["comingSoon"];
  readonly categories: P["categories"];
  readonly eventMeta: {
    [E in keyof P["events"]]: {
      readonly label: P["events"][E]["label"];
      readonly weight: P["events"][E]["weight"];
      readonly kind: P["events"][E]["kind"];
    };
  };
};

export function extractClientShape<P extends ProviderDefinition>(p: P): ClientShape<P> {
  return {
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    icon: p.icon,
    comingSoon: p.comingSoon,
    categories: p.categories,
    eventMeta: Object.fromEntries(
      Object.entries(p.events).map(([k, e]) => [
        k,
        { label: e.label, weight: e.weight, kind: e.kind },
      ])
    ) as ClientShape<P>["eventMeta"],
  };
}
```

#### 2. Create `client-registry.ts`
**File**: `packages/console-providers/src/client-registry.ts` (new)
**Contents**:

```typescript
import { PROVIDERS } from "./registry";
import type { ProviderName } from "./registry";
import { extractClientShape, type ClientShape } from "./define";
import type { ProviderDefinition } from "./define";

export const PROVIDER_CLIENT_REGISTRY = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [key, extractClientShape(p)])
) as { readonly [K in ProviderName]: ClientShape<(typeof PROVIDERS)[K]> };

export type ProviderClientShape = (typeof PROVIDER_CLIENT_REGISTRY)[ProviderName];
```

#### 3. Update `display.ts` as backward-compat shim
**File**: `packages/console-providers/src/display.ts`
**Changes**: After Phase 4 rewrote `display.ts` as derived, this phase further simplifies it to re-export from `client-registry.ts`:

```typescript
// Backward-compat shim — prefer importing from client-registry.ts directly
export { PROVIDER_CLIENT_REGISTRY as PROVIDER_DISPLAY } from "./client-registry";
export type { ProviderClientShape as ProviderDisplayEntry } from "./client-registry";

// Keep derived exports that are used widely:
import { PROVIDER_CLIENT_REGISTRY } from "./client-registry";
import type { ProviderName } from "./registry";

export type ProviderSlug = ProviderName;
export const PROVIDER_SLUGS = Object.keys(PROVIDER_CLIENT_REGISTRY) as ProviderSlug[];
export const ACTIVE_PROVIDER_SLUGS = PROVIDER_SLUGS.filter(
  (slug) => !PROVIDER_CLIENT_REGISTRY[slug].comingSoon
);
export const SOURCE_TYPE_OPTIONS = PROVIDER_SLUGS.map((key) => ({
  value: key,
  label: PROVIDER_CLIENT_REGISTRY[key].displayName,
}));
```

#### 4. Update `index.ts` barrel
**File**: `packages/console-providers/src/index.ts`
**Changes**: Add exports from `client-registry.ts`:
```typescript
export { PROVIDER_CLIENT_REGISTRY, type ProviderClientShape } from "./client-registry";
export { type ClientShape, extractClientShape } from "./define";
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] `ClientShape` type has no function fields (verified by type-level test)
- [ ] `PROVIDER_CLIENT_REGISTRY` contains all 5 providers with correct metadata

#### Manual Verification:
- [ ] UI components that import `PROVIDER_DISPLAY` still work correctly
- [ ] No server-only code (crypto, JWT, env access) is pulled into client bundles

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation.

---

## Phase 9: ManagedProvider Tier

### Overview
Add `ManagedProvider` as a third provider tier for providers where we programmatically register our webhook URL during installation. Add `WebhookSetupDef`, `ManagedWebhookDef`, and `defineManagedProvider` factory. Update `ProviderDefinition` union. Add DB migration.

### Changes Required:

#### 1. Add `WebhookSetupDef` and `ManagedWebhookDef`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add after `WebhookDef`:

```typescript
export const webhookSetupStateSchema = z.object({
  endpointId: z.string(),
  signingSecret: z.string(),
});
export type WebhookSetupState = z.infer<typeof webhookSetupStateSchema>;

export interface WebhookSetupDef<
  TConfig,
  TState extends WebhookSetupState = WebhookSetupState,
> {
  readonly register: (
    config: TConfig,
    token: string,
    webhookUrl: string,
    events: readonly string[]
  ) => Promise<TState>;
  readonly unregister: (
    config: TConfig,
    token: string,
    state: TState
  ) => Promise<void>;
  readonly defaultEvents: readonly string[];
}

export interface ManagedWebhookDef<
  TConfig,
  TState extends WebhookSetupState = WebhookSetupState,
> {
  readonly webhook: WebhookDef<TConfig>;
  readonly setup: WebhookSetupDef<TConfig, TState>;
}
```

#### 2. Add `ManagedProvider` interface
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add after `WebhookProvider`:

```typescript
export interface ManagedProvider<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<string, EventDefinition>,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
> extends BaseProviderFields<
    TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema
  > {
  readonly auth: AuthDef<TConfig, TAccountInfo>;
  readonly backfill?: BackfillDef;
  readonly kind: "managed";
  readonly inbound: ManagedWebhookDef<TConfig>;
}
```

#### 3. Update `ProviderDefinition` union
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add `ManagedProvider` to the union:

```typescript
export type ProviderDefinition<...> =
  | WebhookProvider<...>
  | ManagedProvider<...>
  | ApiProvider<...>;
```

#### 4. Add type guards
**File**: `packages/console-providers/src/define.ts`
**Changes**:

```typescript
export function isManagedProvider(p: { kind: string }): p is ManagedProvider {
  return p.kind === "managed";
}

export function hasInboundWebhooks(
  p: { kind: string }
): p is WebhookProvider | ManagedProvider {
  return p.kind === "webhook" || p.kind === "managed";
}
```

#### 5. Add `defineManagedProvider` factory
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add after `defineApiProvider`:

```typescript
export function defineManagedProvider<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  const TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  const TEvents extends Record<string, EventDefinition> = Record<string, EventDefinition>,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
>(
  def: Omit<
    ManagedProvider<TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema>,
    "env" | "kind"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): ManagedProvider<TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema> {
  let _env: Record<string, string> | undefined;
  return Object.freeze({
    ...def,
    kind: "managed" as const,
    get env(): Record<string, string> {
      _env ??= buildEnvGetter(def.envSchema);
      return _env;
    },
  }) as ManagedProvider<TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema>;
}
```

#### 6. Add DB migration
**File**: `db/console/` (generated via drizzle)
**Changes**: Add `webhookSetupState jsonb` column (nullable) to `gw_installations` table.

```bash
cd db/console && pnpm db:generate && pnpm db:migrate
```

#### 7. Update relay `providerGuard`
**File**: `apps/relay/src/middleware/webhook.ts`
**Changes**: Update from `isWebhookProvider(p)` to `hasInboundWebhooks(p)`. For managed providers, the signing secret comes from `connection.webhookSetupState.signingSecret`.

#### 8. Update gateway callback
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: After `processCallback` for a managed provider, call `setup.register()` and persist the returned state to `gw_installations.webhookSetupState`.

#### 9. Update exports
**File**: `packages/console-providers/src/index.ts`
**Changes**: Export `ManagedProvider`, `ManagedWebhookDef`, `WebhookSetupDef`, `WebhookSetupState`, `webhookSetupStateSchema`, `defineManagedProvider`, `isManagedProvider`, `hasInboundWebhooks`.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] DB migration applies cleanly: `pnpm db:generate && pnpm db:migrate`
- [ ] `ProviderDefinition` union includes 3 members (WebhookProvider, ManagedProvider, ApiProvider)

#### Manual Verification:
- [ ] Existing webhook providers continue to work unchanged
- [ ] Relay correctly distinguishes webhook vs managed providers
- [ ] Gateway callback handles managed provider setup flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests:
- `define.ts` — Test `deriveVerifySignature` with all HMAC variants (SHA-256, SHA-1, SHA-512) and with/without prefix
- `define.ts` — Test `extractClientShape` returns only data fields, no functions
- `registry.ts` — Test auto-derived `providerAccountInfoSchema` validates all 5 provider account infos
- `registry.ts` — Test auto-derived `providerConfigSchema` validates all 5 provider configs
- Each provider — Test `signatureScheme` round-trips through `signatureSchemeSchema.parse()`
- `define.ts` — Test `connectionStatusSchema.parse()` for all 3 statuses

### Integration Tests:
- Relay — Webhook signature verification with real provider signature headers
- Gateway — OAuth/App-Token callback flow end-to-end
- Gateway — Managed provider setup.register() + teardown

### Type-Level Tests:
```typescript
type Assert<T, U extends T> = true;
type _1 = Assert<(typeof PROVIDERS)["github"]["auth"]["kind"], "app-token">;
type _2 = Assert<(typeof PROVIDERS)["github"]["auth"]["usesStoredToken"], false>;
type _3 = Assert<(typeof PROVIDERS)["apollo"]["auth"]["kind"], "api-key">;
// After Phase 2: no lifecycle or classifier fields exist on any provider
type _4 = Assert<"lifecycle" extends keyof (typeof PROVIDERS)["github"], false>;
type _5 = Assert<"classifier" extends keyof (typeof PROVIDERS)["github"], false>;
```

## Performance Considerations

- `deriveVerifySignature` is called per webhook — negligible overhead (one function creation, cached via closure)
- `PROVIDER_CLIENT_REGISTRY` is built once at module load — no runtime cost
- Auto-derived discriminated unions use `Object.values()` once at module load
- `healthCheck.check()` (when implemented) makes one API call per connection per poll interval — negligible

## Migration Notes

- No breaking changes for external consumers — `index.ts` barrel re-exports all existing symbols
- `display.ts` exports are preserved via shim — existing imports continue to work
- `gateway.ts` split is non-breaking — `index.ts` re-exports from all three files
- `ProviderConfigMap` removal is internal — it was never exported
- GitHub's `auth.kind` changes from `"oauth"` to `"app-token"` — any code that checks `auth.kind === "oauth"` for GitHub specifically needs updating (gateway callback handlers)
- The `webhookSecretEnvKey` map deletion in relay is a runtime change — verify all 4 providers' secrets resolve correctly via `extractSecret(providerConfig)`
- `LifecycleDef`, `LifecycleReason`, and `EventClassifier` are deleted — any external code importing these types must be updated (no known external consumers exist)
- `classifier` and `lifecycle` fields are removed from `WebhookProvider` — any code accessing `provider.classifier` or `provider.lifecycle` will get a compile error (confirmed: no runtime consumer exists)

## References

- Synthesis: `thoughts/shared/research/2026-03-18-provider-architecture-synthesis.md`
- Lifecycle runtime plan: `thoughts/shared/plans/2026-03-17-lifecycle-v1-polling-passive.md` *(partially superseded — HealthCheckDef interface now in Phase 2; runtime cron infrastructure remains relevant)*
- Future innovations: `thoughts/shared/research/2026-03-18-provider-architecture-future.md`
- Extensibility plan: `thoughts/shared/plans/2026-03-17-provider-architecture-extensibility.md` *(superseded by this plan)*
- Provider redesign research: `thoughts/shared/research/2026-03-17-provider-architecture-redesign.md`

---

## Update Log

### 2026-03-18 — Architectural optimization pass

- **Trigger**: Pre-implementation review identified 5 structural issues before any code was written.
- **Changes**:
  - **Phase 3** — Removed `ed25519SchemeSchema` from scope; `SignatureScheme` is now HMAC-only. `deriveVerifySignature` is now exhaustive with no dead `return false` fallthrough. Ed25519 added to "What We're NOT Doing" (requires `@noble/ed25519`, no current provider needs it).
  - **Phase 4** — Removed the `display.ts` rewrite. Phase 4 now only adds `icon`/`comingSoon` to `BaseProviderFields` and moves SVG data into providers. The `display.ts` rewrite is handled entirely by Phase 8 (`PROVIDER_CLIENT_REGISTRY`) to avoid writing the same file twice.
  - **Phase 7** — Replaced startup-time eager config building (`Object.entries(PROVIDERS).map(createConfig)`) with per-request lazy resolution. Startup builds would crash the relay if any provider's env vars are missing. Lazy resolution is resilient to partial deployments.
  - **Phase 7** — Made explicit that it depends on Phase 9's `hasInboundWebhooks` guard. Updated Implementation Approach to reflect this dependency.
  - **Phase 10** — Made `healthCheck` optional (`?`) on all provider interfaces. Apollo API keys don't expire and have no reliable revocation endpoint; forcing an implementation creates speculative API calls. The lifecycle polling workflow skips providers where `healthCheck` is undefined.
- **Impact on remaining work**: All 10 phases remain in scope. Phases 1-6, 8-9 are unchanged in substance. Phase 7 and 10 have cleaner, more resilient implementations.

### 2026-03-18 — Drop lifecycle, promote HealthCheckDef

- **Trigger**: During Phase 2 implementation, analysis revealed `LifecycleDef`, `EventClassifier`, and `LifecycleReason` are entirely dead code — no runtime consumer exists in any app. The opinionated webhook-event-based lifecycle model (GitHub `installation.deleted`, etc.) is over-engineered for v1 and doesn't generalize to API-key providers.
- **Changes**:
  - **Phase 2** — Completely rewritten: "Lifecycle Optional" → "Drop Lifecycle + Classifier, Add HealthCheckDef". Deletes `LifecycleDef`, `LifecycleReason`, `EventClassifier`, `classifier` field, and `lifecycle` field. Adds universal `HealthCheckDef` on `BaseProviderFields` (optional) with simple `ConnectionStatus` enum (`"healthy" | "revoked" | "suspended"`). Health check implementations deferred.
  - **Phase 9** — `ManagedWebhookDef` no longer has `classifier` or `lifecycle` fields (both deleted in Phase 2). `ManagedProvider` inherits `healthCheck?` from `BaseProviderFields`.
  - **Phase 10** — Deleted entirely (absorbed into Phase 2). The interface definition is now Phase 2; per-provider implementations and runtime infrastructure (Inngest cron) are deferred follow-up work.
  - **"What We're NOT Doing"** — Added: classifier-based event routing, health check implementations, webhook-based lifecycle detection.
  - **Testing Strategy** — Updated type-level tests to assert lifecycle/classifier fields are absent.
  - **Implementation Approach** — Added type-safety principle: verify types in console-providers before touching consumers.
- **Impact on remaining work**: Plan reduced from 10 to 9 phases. Phases 3-9 are unchanged in substance (Phase 9's `ManagedWebhookDef` is 2 fields lighter). No new phase dependencies introduced.
