# Provider Architecture Redesign — Implementation Plan

## Overview

Implement 10 targeted changes to the `console-providers` package that achieve tRPC-level type safety, Zod-first signature verification, a 3-tier provider model (`WebhookProvider | ManagedProvider | ApiProvider`), universal connection health monitoring, complete provider type coverage (every research-identified provider has a home), and 1-touch provider addition. Based on the synthesis at `thoughts/shared/research/2026-03-18-provider-architecture-synthesis.md`.

## Current State Analysis

The provider system (`packages/console-providers/src/`) has a 2-tier discriminated union (`WebhookProvider | ApiProvider`) with five providers (apollo, github, linear, sentry, vercel). The system works but has structural gaps that make adding providers a multi-file ordeal and mistype GitHub's auth semantics.

### Key Discoveries:
- `define.ts:503` — `WebhookProvider.auth` hardcoded to `OAuthDef` only; GitHub is structurally an App Token provider using OAuth as a workaround
- `define.ts:554-558` — `WebhookProvider.classifier` and `WebhookProvider.lifecycle` are required but **never consumed** at runtime — dead code across all apps (relay, gateway, backfill); `connectionLifecycleWorkflow` referenced in comments does not exist
- `registry.ts:22-28` — `ProviderConfigMap` must be manually updated alongside `PROVIDERS`
- `registry.ts:136-155` — Two manual `z.discriminatedUnion` tuples must be updated per provider
- `display.ts:18-67` — 89-line static object duplicating `name`, `displayName`, `description` from provider definitions; sync enforced only by `display-sync.test.ts` at test-run time, not compile time
- 19 client-side consumers of `display.ts` across `apps/console` (13 `'use client'` components, 6 server components); all icon rendering flows through a single `ProviderIcon` component in `apps/console/src/lib/provider-icon.tsx`
- `@repo/app-providers` has two tsup entry points: `"."` (server, full registry) and `"./display"` (client-safe, zero runtime imports); the client/server split is a **convention** — no `server-only` enforcement exists to prevent barrel imports in client code
- `relay/src/middleware/webhook.ts:65-82` — `webhookSecretEnvKey` manual map, separate from provider definitions
- `gateway.ts` — 222 lines mixing 4 distinct cross-service contracts
- No `signatureScheme` field exists — each provider implements `verifySignature` independently
- No `client-registry.ts`, `wire.ts`, or `backfill-contracts.ts` exist yet
- `IconDef` schema exists in `define.ts:731-735` but is not referenced by any provider interface
- All 4 webhook providers (github, linear, sentry, vercel) use HMAC-SHA256 or HMAC-SHA1 with the same `computeHmac` + `timingSafeEqual` pattern

## Desired End State

After all 10 changes:
- Adding a provider is a **1-touch operation** (add to `PROVIDERS` only)
- `PROVIDERS.github.auth` has type `AppTokenDef`, not `OAuthDef`
- `LifecycleDef`, `EventClassifier`, and `LifecycleReason` are deleted — replaced by universal `HealthCheckDef`
- `HealthCheckDef` on `BaseProviderFields` (optional) enables 401-poll connection health monitoring across all provider tiers
- Signature schemes are pure Zod data — relay derives secrets from provider definitions
- `ManagedProvider` tier exists for programmatic webhook registration (HubSpot, Stripe)
- `ApiProvider` can optionally receive inbound webhooks via `inbound?: InboundWebhookDef` (Clerk, Datadog)
- `WebhookProvider.auth` accepts full `AuthDef` — webhook providers can use API key auth (Stripe)
- Ed25519 signature verification is supported — Clerk/Svix/Discord webhooks are typeable
- **`display.ts` is the canonical source of truth for all display metadata** — providers spread from it; no duplication between display and provider definitions
- Adding a provider to `display.ts` without `comingSoon: true` is a **compile-time error** until a matching implementation exists in `PROVIDERS` (type-level enforcement, zero runtime overhead)
- `import "server-only"` on `index.ts` makes it a **build-time error** for any client component to import from the barrel — hard boundary, not convention
- `gateway.ts` is split into single-consumer contract files
- **Every provider in the research taxonomy has a typed home** — no architectural decisions needed when new providers arrive

### Verification:
```bash
pnpm typecheck         # zero errors across all apps
pnpm check             # zero lint errors
pnpm --filter @repo/app-providers test   # all tests pass
```

## What We're NOT Doing

- **`PollingDef`** — continuous scheduled pull for PostHog/Amplitude (requires polling worker service)
- ~~**`WebhookCapability` on `ApiProvider`**~~ — moved to Phase 10 as `InboundWebhookDef` on `ApiProvider`
- **Category ↔ BackfillEntityType unification** — deferred to future research
- **Typed payload pipeline** — `payload: z.unknown()` → typed end-to-end (high-impact but requires typed `WebhookEnvelope` variants)
- **Relay auto-registration factory** — `createWebhookRouter(PROVIDERS)` (deferred)
- **Provider telemetry schema** — structured `TelemetryEvent` (deferred)
- **`StreamingDef`** — Salesforce CDC, Kafka-style providers (future primitive)
- **ManagedProvider runtime wiring** — DB migration (`webhookSetupState` column), relay `providerGuard` → `hasInboundWebhooks`, gateway callback managed provider setup flow — deferred until first concrete managed provider (HubSpot, Stripe) is added; type architecture is complete in Phase 9
- **Database schema changes** — no schema changes in this plan; `webhookSetupState` column deferred with ManagedProvider runtime wiring
- **Changing `BackfillDef`, `ResourcePickerDef`, or `ProviderApi` structures** — already correct
- ~~**Ed25519 signature scheme**~~ — moved to Phase 10; exercises the union-first `SignatureScheme` architecture from Phase 3
- **Classifier-based event routing** — `EventClassifier` ("lifecycle" | "data" | "unknown") was dead code and is deleted in Phase 2; future DLQ/routing logic can be re-introduced when the relay actually needs it
- **HealthCheck implementations** — Phase 2 defines the `HealthCheckDef` interface only; per-provider implementations (API calls, 401 detection) are a follow-up task
- **Webhook-based lifecycle detection** — the old model (GitHub `installation.deleted`, Vercel `integration-configuration.removed`) is replaced by simple 401-poll health checks; providers that send lifecycle-type webhooks still receive them as data events
- **`ClientShape<P>` / `extractClientShape` / `client-registry.ts` / `PROVIDER_CLIENT_REGISTRY`** — superseded by display-first architecture; `display.ts` is already the client registry; no build-time extraction needed
- **Moving display data to `index.ts` barrel** — `display.ts` stays a separate zero-import entry point; providers import FROM it (not the other way around)

## Implementation Approach

Changes are ordered by dependency. Phases 1-3 are sequential (each builds on the previous). **Phase 4 absorbs the original Phases 5 and 8** — all three address the registry architecture and have no external dependencies beyond Phase 3. Phases 4 and 6 are independent and can be done in any order after Phase 3. Phase 7 requires Phase 3 (relay uses `deriveVerifySignature`). Phase 9 is type-architecture-only (interfaces, guards, factory, exports) with no consumer changes — depends on Phase 3. Phase 10 depends on Phases 3 and 9 (extends `SignatureScheme` and updates `hasInboundWebhooks`). The relay guard migration (`isWebhookProvider` → `hasInboundWebhooks`) is deferred until the first concrete managed provider is added.

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
- [x] All tests pass: `pnpm --filter @repo/app-providers test`
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
- [x] All tests pass: `pnpm --filter @repo/app-providers test`
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
Add `SignatureScheme` as a pure Zod data declaration on `WebhookDef`. Establish a discriminated union (`signatureSchemeSchema = z.discriminatedUnion("kind", [hmacSchemeSchema])`) with a single HMAC member today. Future scheme variants (ed25519, base64 HMAC, sha512) extend the union array only — `WebhookDef` and all consumers remain untouched. Implement `deriveVerifySignature` as an exhaustive `switch` dispatcher with a `satisfies`-guarded algorithm map. Add `signatureScheme` to all 4 webhook providers and remove their manual `verifySignature` implementations.

### Extension Protocol (no `WebhookDef` changes required)

| Want | Do | Don't touch |
|------|-----|-------------|
| Add sha512 | Add to `hmacSchemeSchema.algorithm` enum + update `HMAC_ALGO_MAP` + extend `computeHmac` | `WebhookDef`, `ProviderDefinition`, relay |
| Add base64 encoding | Add `encoding` field to `hmacSchemeSchema` with `.default("hex")` + update `_deriveHmacVerify` | Existing providers (back-compat default), `WebhookDef` |
| Add ed25519 | New `ed25519SchemeSchema` + add to union array + new `case` in `deriveVerifySignature` | `WebhookDef`, `ProviderDefinition`, relay |

### Changes Required:

#### 1. Add Zod signature scheme schemas
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add after the existing imports/schemas (before `WebhookDef`):

```typescript
// ── Signature Schemes (ZOD-FIRST — pure data, no functions) ─────────────────
// hmacSchemeSchema is the only variant today. It is unexported (internal) because
// consumers depend on SignatureScheme (the union), never on a specific variant.
// Adding sha512: add to algorithm enum + update HMAC_ALGO_MAP.
// Adding base64: add encoding field with .default("hex") + update _deriveHmacVerify.
// Adding ed25519: new ed25519SchemeSchema + add to union array + new case below.
// In all cases: WebhookDef, ProviderDefinition, and relay middleware are untouched.

const hmacSchemeSchema = z.object({
  kind: z.literal("hmac"),
  algorithm: z.enum(["sha256", "sha1"]),
  signatureHeader: z.string(),
  prefix: z.string().optional(),
});

// PUBLIC interface — WebhookDef uses SignatureScheme, never the variant schemas.
// New variants extend this array only.
export const signatureSchemeSchema = z.discriminatedUnion("kind", [
  hmacSchemeSchema,
]);

export type HmacScheme = z.infer<typeof hmacSchemeSchema>;
export type SignatureScheme = z.infer<typeof signatureSchemeSchema>;

// Literal-type-preserving factory: PROVIDERS.github.webhook.signatureScheme.algorithm
// narrows to "sha256" (not the full "sha256" | "sha1" union) — enables precise
// type-level tests without narrowing ceremony at call sites.
export const hmac = <const T extends Omit<HmacScheme, "kind">>(
  opts: T
): { readonly kind: "hmac" } & T => ({ kind: "hmac", ...opts });
```

#### 2. Add `signatureScheme` to `WebhookDef`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add `signatureScheme` field to `WebhookDef` interface. Make `verifySignature` optional — relay falls back to `deriveVerifySignature`. A provider may supply a custom override only if its scheme is non-HMAC or non-standard.

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
**Changes**: Add after `signatureSchemeSchema`. The exhaustive `switch` and `satisfies`-guarded map enforce that new variants/algorithms can never be silently skipped:

```typescript
type VerifyFn = (rawBody: string, headers: Headers, secret: string) => boolean;

// Exhaustive algorithm map. `satisfies Record<HmacScheme["algorithm"], ...>` causes
// a TypeScript error when sha512 (or any new algorithm) is added to the enum but
// not yet added here — no silent fallthrough to a wrong algorithm.
const HMAC_ALGO_MAP = {
  sha256: "SHA-256",
  sha1:   "SHA-1",
} as const satisfies Record<HmacScheme["algorithm"], "SHA-256" | "SHA-1">;

function _deriveHmacVerify(scheme: HmacScheme): VerifyFn {
  return (rawBody, headers, secret) => {
    const rawSig = headers.get(scheme.signatureHeader);
    if (!rawSig) return false;
    const received = scheme.prefix ? rawSig.slice(scheme.prefix.length) : rawSig;
    const expected = computeHmac(rawBody, secret, HMAC_ALGO_MAP[scheme.algorithm]);
    return timingSafeEqual(received, expected);
  };
}

// Exhaustive switch — TypeScript errors if a new `kind` is added to
// signatureSchemeSchema without a corresponding case here.
export function deriveVerifySignature(scheme: SignatureScheme): VerifyFn {
  switch (scheme.kind) {
    case "hmac": return _deriveHmacVerify(scheme);
  }
}
```

#### 4. Add `signatureScheme` to all 4 webhook providers

**GitHub** (`providers/github/index.ts`): Add `signatureScheme`, delete `verifySignature`:
```typescript
signatureScheme: hmac({
  algorithm: "sha256",
  signatureHeader: "x-hub-signature-256",
  prefix: "sha256=",
}),
// DELETE verifySignature — derived automatically
```

**Linear** (`providers/linear/index.ts`): Add `signatureScheme`, delete `verifySignature`:
```typescript
signatureScheme: hmac({
  algorithm: "sha256",
  signatureHeader: "linear-signature",
}),
// DELETE verifySignature
```

**Sentry** (`providers/sentry/index.ts`): Add `signatureScheme`, delete `verifySignature`:
```typescript
signatureScheme: hmac({
  algorithm: "sha256",
  signatureHeader: "sentry-hook-signature",
}),
// DELETE verifySignature
```

**Vercel** (`providers/vercel/index.ts`): Add `signatureScheme`, delete `verifySignature`:
```typescript
signatureScheme: hmac({
  algorithm: "sha1",
  signatureHeader: "x-vercel-signature",
}),
// DELETE verifySignature
```

#### 5. Update relay signature verification
**File**: `apps/relay/src/middleware/webhook.ts`
**Changes**: In the `signatureVerify` middleware (~line 242), replace the direct call with the fallback pattern. Import `deriveVerifySignature` from `@repo/app-providers`.

```typescript
// Before:
const verified = providerDef.webhook.verifySignature(rawBody, c.req.raw.headers, secret);

// After:
const verify = providerDef.webhook.verifySignature
  ?? deriveVerifySignature(providerDef.webhook.signatureScheme);
const verified = verify(rawBody, c.req.raw.headers, secret);
```

Note: The relay's mismatch diagnostic logging (line 248) still hardcodes `"x-hub-signature-256"`. Updating it to read `signatureScheme.signatureHeader` is scoped to Phase 7, which rewrites the relay's secret resolution.

#### 6. Update exports
**File**: `packages/console-providers/src/index.ts`
**Changes**: Add:
```typescript
export { deriveVerifySignature, hmac, signatureSchemeSchema } from "./define";
export type { HmacScheme, SignatureScheme } from "./define";
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] All tests pass: `pnpm --filter @repo/app-providers test`
- [x] Runtime validation: `signatureSchemeSchema.parse(PROVIDERS.github.webhook.signatureScheme)` succeeds
- [x] Runtime validation: all 4 webhook providers' `signatureScheme` fields parse cleanly
- [x] Type assertion: `PROVIDERS.github.webhook.signatureScheme.algorithm` resolves to literal `"sha256"`, not the full union
- [x] Type assertion: `PROVIDERS.vercel.webhook.signatureScheme.algorithm` resolves to literal `"sha1"`
- [ ] Exhaustiveness check: adding a new `kind` to `signatureSchemeSchema` without a `case` in `deriveVerifySignature` causes a TypeScript error (verified by temporarily adding a dummy variant)

#### Manual Verification:
- [ ] GitHub webhook signature verification still works (send test webhook via ngrok)
- [ ] Linear webhook signature verification still works
- [ ] Sentry webhook signature verification still works
- [ ] Vercel webhook signature verification still works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that all webhook signature verification still works.

---

## Phase 4: Zod-First Registry Unification

> **Absorbs original Phases 5 and 8** — all three address the registry architecture with no external dependencies beyond Phase 3.

### Overview

A comprehensive rework that unifies the display and server registries under a Zod-first architecture with a hard client/server boundary. After this phase:

- `display.ts` is the canonical slug source — `providerSlugSchema` (Zod enum) is the single definition; `ProviderName` and `SourceType` are aliases
- `ProviderDisplayEntry` is a Zod-inferred type, not a hand-written TypeScript interface
- Provider definitions spread from `PROVIDER_DISPLAY` — zero duplication, single source
- `ProviderConfigMap` is deleted — `PROVIDERS` is `as const` without the manual satisfies shim
- Discriminated unions are auto-derived from `Object.values(PROVIDERS)`
- `providerKindSchema` and `authKindSchema` are Zod enums that anchor the discriminant literals in factories and interfaces
- `import "server-only"` on the barrel makes it a build-time error for client components to import runtime values
- `display-sync.test.ts` deleted — the type system enforces everything it tested, bidirectionally

### Architecture

```
display.ts (CLIENT-SAFE — zero imports, leaf node)
  providerDisplayEntrySchema   ← Zod schema; ProviderDisplayEntry = z.infer<…>
  PROVIDER_DISPLAY             ← as const satisfies Record<string, ProviderDisplayEntry>
  providerSlugSchema           ← z.enum(keys) with .meta() — THE canonical slug source
  type ProviderSlug            ← z.infer<typeof providerSlugSchema>
  PROVIDER_SLUGS, ACTIVE_PROVIDER_SLUGS, SOURCE_TYPE_OPTIONS  ← unchanged, derived

define.ts (SERVER-ONLY)
  providerKindSchema           ← z.enum(["webhook", "api"])  — anchors factory discriminant
  authKindSchema               ← z.enum(["oauth", "api-key", "app-token"]) — anchors auth kind
  BaseProviderFields           ← gains icon: IconDef, comingSoon?: true
  Factories                    ← inject kind constrained via satisfies z.infer<providerKindSchema>

registry.ts (SERVER-ONLY)
  PROVIDERS                    ← as const  (NO ProviderConfigMap)
  sourceTypeSchema             ← re-export of providerSlugSchema
  type ProviderName            ← = ProviderSlug (alias)
  type SourceType              ← = ProviderSlug (alias)
  providerAccountInfoSchema    ← auto-derived, Zod 4 discriminated union
  providerConfigSchema         ← auto-derived, Zod 4 discriminated union
  _AssertDisplayComplete       ← compile-time completeness enforcement

index.ts
  import "server-only"         ← hard build-time boundary (first line)
```

### Why behavioral interfaces stay as TypeScript

`AuthDef` (`OAuthDef | ApiKeyDef | AppTokenDef`), `WebhookDef<TConfig>`, `BackfillDef`, `ResourcePickerDef`, `HealthCheckDef<TConfig>`, and `ProviderApi` all contain generic functions parameterized by `TConfig`. Converting these to Zod schemas via `z.function()` erases generics — inference degrades to `(...args: unknown[]) => unknown`. The current TypeScript interfaces are strictly more type-safe. These **must** remain TypeScript interfaces.

What CAN and SHOULD be Zod schemas: display metadata, slug enum, provider kind enum, auth kind enum, and all data-only fields that already are (categories, actions, signature schemes, connection status, etc.).

### Why `z.registry()` is not the right tool here

Zod 4's `z.registry()` maps schemas → metadata via WeakMap. It shines for dynamic/unknown schema sets (form builders, plugin systems). Our provider registry is static — 5 entries known at compile time. A WeakMap lookup over a static object adds indirection without value. More critically: `z.registry()` requires server-side access to schema objects, so it cannot solve the client/server split. The display-first spread pattern is simpler and faster.

**Exception**: `.meta()` on public-facing schemas (`providerSlugSchema`, `sourceTypeSchema`, `providerKindSchema`, `authKindSchema`) provides title/description/examples metadata that flows automatically into `zod-openapi` / JSON Schema generation in `packages/console-openapi`. This is cheap and additive.

---

### Changes Required

#### 1. `display.ts` — Zod schema + canonical slug enum

**File**: `packages/console-providers/src/display.ts`

**Changes**: Convert the unexported TypeScript `ProviderDisplayEntry` interface to a Zod schema. Export it and derive `ProviderDisplayEntry` type via `z.infer`. Add `providerSlugSchema` as a Zod enum derived from `PROVIDER_DISPLAY` keys, with `.meta()`. Export `providerSlugSchema` and `ProviderSlug`.

```typescript
import { z } from "zod";
// type-only import — erased at compile time, zero runtime cost
import type { IconDef } from "./define";

export type { IconDef } from "./define";

// ── Provider Display Schema ────────────────────────────────────────────────────
// Zod schema is the source of truth; ProviderDisplayEntry type is inferred.
// Zero runtime imports — this file is the client-safe leaf node.

export const providerDisplayEntrySchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  icon: z.custom<IconDef>(),   // IconDef is { viewBox: string; d: string } — validated by iconDefSchema on server
  comingSoon: z.literal(true).optional(),
});

export type ProviderDisplayEntry = z.infer<typeof providerDisplayEntrySchema>;

export const PROVIDER_DISPLAY = {
  apollo: { ... },
  github: { ... },
  // ... unchanged data
} as const satisfies Record<string, ProviderDisplayEntry>;

// ── Canonical Slug Source ─────────────────────────────────────────────────────
// ALL slug-based types (ProviderName, SourceType) are aliases of ProviderSlug.
// providerSlugSchema is the single Zod source; sourceTypeSchema re-exports it.

export const providerSlugSchema = z
  .enum(
    Object.keys(PROVIDER_DISPLAY) as [
      keyof typeof PROVIDER_DISPLAY,
      ...(keyof typeof PROVIDER_DISPLAY)[],
    ]
  )
  .meta({
    id: "ProviderSlug",
    title: "Provider Slug",
    description: "Unique identifier for a data source provider",
    examples: ["github"],
  });

export type ProviderSlug = z.infer<typeof providerSlugSchema>;

// ── Derived collections (unchanged behavior) ─────────────────────────────────
export const PROVIDER_SLUGS = Object.keys(PROVIDER_DISPLAY) as ProviderSlug[];
export const ACTIVE_PROVIDER_SLUGS = PROVIDER_SLUGS.filter(
  (slug) => !(PROVIDER_DISPLAY[slug] as ProviderDisplayEntry).comingSoon
);
export const SOURCE_TYPE_OPTIONS = PROVIDER_SLUGS.map((key) => ({
  value: key,
  label: PROVIDER_DISPLAY[key].displayName,
}));
```

**Note on `z.custom<IconDef>()`**: `IconDef` = `{ viewBox: string; d: string }`. Using `z.custom<IconDef>()` in display.ts avoids importing `iconDefSchema` from `define.ts` (which would pull in server dependencies). The full runtime validation of `IconDef` continues to happen in `define.ts` via `iconDefSchema`. Display.ts only needs the type.

---

#### 2. `define.ts` — Zod discriminant enums + BaseProviderFields update

**File**: `packages/console-providers/src/define.ts`

**Changes A — Add `providerKindSchema` and `authKindSchema`**: Add after the existing imports, before `BaseProviderFields`.

```typescript
// ── Provider Kind + Auth Kind (Zod enums — anchor discriminant literals) ─────
// Phase 9 adds "managed" to providerKindSchema.

export const providerKindSchema = z
  .enum(["webhook", "api"])
  .meta({
    id: "ProviderKind",
    title: "Provider Kind",
    description: "Discriminant for the provider tier",
  });
export type ProviderKind = z.infer<typeof providerKindSchema>;

export const authKindSchema = z
  .enum(["oauth", "api-key", "app-token"])
  .meta({
    id: "AuthKind",
    title: "Auth Kind",
    description: "Authentication strategy used by the provider",
  });
export type AuthKind = z.infer<typeof authKindSchema>;
```

**Changes B — Add `icon` and `comingSoon` to `BaseProviderFields`**: Add after the `optional` field.

```typescript
/** SVG icon data — sourced from display.ts spread, never server-only */
readonly icon: IconDef;
/** When true, provider is visible in UI as "coming soon" but not yet selectable */
readonly comingSoon?: true;
```

**Changes C — Constrain factory `kind` injection via `satisfies`**: In `defineWebhookProvider` and `defineApiProvider`, change the injected `kind` literal to use a `satisfies` constraint against the Zod-inferred type. This creates a compile-time link: if "webhook" is ever removed from `providerKindSchema`, the factory fails to compile.

```typescript
// defineWebhookProvider (line ~770):
// Before:
kind: "webhook" as const,

// After:
kind: ("webhook" as const) satisfies z.infer<typeof providerKindSchema>,

// defineApiProvider (line ~827) — same pattern:
kind: ("api" as const) satisfies z.infer<typeof providerKindSchema>,
```

---

#### 3. All 5 providers — spread from `display.ts`

**Files**: `providers/apollo/index.ts`, `providers/github/index.ts`, `providers/linear/index.ts`, `providers/sentry/index.ts`, `providers/vercel/index.ts`

**Changes**: Import `PROVIDER_DISPLAY` from `../../display`. Replace the manual `name`, `displayName`, `description` fields with a spread. The spread also provides `icon` (new required field on `BaseProviderFields`) and `comingSoon` (satisfies the optional field for apollo, vercel, linear, sentry).

```typescript
// Before (github/index.ts):
export const github = defineWebhookProvider({
  name: "github",
  displayName: "GitHub",
  description: "Connect your GitHub repositories",
  // ... server-only fields ...
});

// After:
import { PROVIDER_DISPLAY } from "../../display";

export const github = defineWebhookProvider({
  ...PROVIDER_DISPLAY.github,       // name, displayName, description, icon
  // server-only fields below — unchanged:
  configSchema: githubConfigSchema,
  auth: { kind: ("app-token" as const) satisfies AuthKind, ... },
  webhook: { ... },
  // ...
});
```

TypeScript errors at the spread site if a key doesn't exist in `PROVIDER_DISPLAY` — you cannot implement without display data first. The `comingSoon` field flows through the spread automatically; no explicit `comingSoon: true` in provider definitions.

**Auth kind `satisfies` constraint** (optional, recommended): At each provider's `auth` block, add the `satisfies` annotation to the `kind` literal. This links the auth strategy kind to `authKindSchema`.

```typescript
// GitHub:
kind: ("app-token" as const) satisfies AuthKind,

// Linear, Sentry, Vercel (OAuth):
kind: ("oauth" as const) satisfies AuthKind,

// Apollo (API key):
kind: ("api-key" as const) satisfies AuthKind,
```

---

#### 4. `registry.ts` — Delete ProviderConfigMap + auto-derive unions + completeness assertion

**File**: `packages/console-providers/src/registry.ts`

**Changes A — Delete `ProviderConfigMap` and config type imports**: Delete the `ProviderConfigMap` interface (lines 22-28) and the config type imports (lines 7-16: `ApolloConfig`, `GitHubConfig`, `LinearConfig`, `SentryConfig`, `VercelConfig`). These are only used by `ProviderConfigMap`. The factory functions already enforce type correctness at each provider's call site — the `satisfies` shim is unnecessary.

```typescript
// Before:
import type { ApolloConfig } from "./providers/apollo/auth";
// ... 4 more config imports ...

interface ProviderConfigMap {
  readonly apollo: ApolloConfig;
  // ...
}

export const PROVIDERS = { ... } as const satisfies {
  readonly [K in keyof ProviderConfigMap]: ProviderDefinition<ProviderConfigMap[K]>;
};

// After:
export const PROVIDERS = {
  apollo, github, vercel, linear, sentry,
} as const;
```

**Changes B — Import `providerSlugSchema` + re-export as `sourceTypeSchema`**: Import from `./display` and re-export as the canonical sourceType schema. Unify `ProviderName` and `SourceType` as aliases of `ProviderSlug`.

```typescript
import { providerSlugSchema } from "./display";
import type { ProviderSlug } from "./display";

// sourceTypeSchema IS providerSlugSchema — single canonical source
export { providerSlugSchema as sourceTypeSchema } from "./display";
export type { ProviderSlug } from "./display";

// Semantic aliases — structurally identical to ProviderSlug
export type ProviderName = ProviderSlug;
export type SourceType = ProviderSlug;
```

**Changes C — Auto-derive discriminated unions (Zod 4 auto-detect)**:

```typescript
// ── Account Info Schema ───────────────────────────────────────────────────────
// Adding a provider = add to PROVIDERS only. No manual tuple maintenance.

const _accountInfoSchemas = Object.values(PROVIDERS).map(
  (p) => p.accountInfoSchema
) as [
  (typeof PROVIDERS)[keyof typeof PROVIDERS]["accountInfoSchema"],
  ...(typeof PROVIDERS)[keyof typeof PROVIDERS]["accountInfoSchema"][],
];
// Zod 4: discriminant key auto-detected ("sourceType" — common literal field across all schemas)
export const providerAccountInfoSchema = z.discriminatedUnion(
  "sourceType",
  _accountInfoSchemas
);
export type ProviderAccountInfo = z.infer<typeof providerAccountInfoSchema>;

// ── Provider Config Schema ────────────────────────────────────────────────────
const _configSchemas = Object.values(PROVIDERS).map(
  (p) => p.providerConfigSchema
) as [
  (typeof PROVIDERS)[keyof typeof PROVIDERS]["providerConfigSchema"],
  ...(typeof PROVIDERS)[keyof typeof PROVIDERS]["providerConfigSchema"][],
];
// Zod 4: discriminant key auto-detected ("provider" — common literal field)
export const providerConfigSchema = z.discriminatedUnion(
  "provider",
  _configSchemas
);
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
```

**Changes D — Add `_AssertDisplayComplete` compile-time completeness enforcement**: Place after `PROVIDERS` declaration. This assertion ensures every live display entry has a corresponding `PROVIDERS` implementation.

```typescript
import type { PROVIDER_DISPLAY } from "./display";

// ── Compile-time display completeness enforcement ────────────────────────────
// Derive "live" display keys — entries without comingSoon: true.
type _LiveDisplayKeys = {
  [K in keyof typeof PROVIDER_DISPLAY]:
    (typeof PROVIDER_DISPLAY)[K] extends { comingSoon: true } ? never : K;
}[keyof typeof PROVIDER_DISPLAY];

// _MissingProviders = live display entries with no PROVIDERS implementation.
// Non-empty → the declared type cannot be 'true' → TypeScript error names the slug(s).
type _MissingProviders = Exclude<_LiveDisplayKeys, keyof typeof PROVIDERS>;
type _AssertDisplayComplete = [_MissingProviders] extends [never]
  ? true
  : {
      "ERROR — add to PROVIDERS or mark comingSoon: true in display.ts": _MissingProviders;
    };
// Zero runtime overhead — declare const is type-checked only.
declare const _assertDisplayComplete: _AssertDisplayComplete;
```

**What this enforces (bidirectional)**:
- Add `stripe` to `display.ts` as live (no `comingSoon`) + omit from `PROVIDERS` → compile error naming `"stripe"`
- Add `stripe` to `display.ts` with `comingSoon: true` + omit from `PROVIDERS` → no error (gated)
- Add `stripe` to `PROVIDERS` without `display.ts` entry → compile error at the `...PROVIDER_DISPLAY.stripe` spread site in the provider definition file

**Changes E — Remove deprecated `sourceTypeSchema` definition**: The existing `sourceTypeSchema` (line ~50) that calls `z.enum(Object.keys(PROVIDERS) as ...)` is replaced by the re-export of `providerSlugSchema` in Change B. Delete the old definition.

---

#### 5. `index.ts` — `server-only` boundary + updated exports

**File**: `packages/console-providers/src/index.ts`

**Changes A — Add `server-only` dependency and import**:

```bash
pnpm --filter @repo/app-providers add server-only
```

Add as the very first line of `index.ts`:

```typescript
import "server-only";
```

This makes it a Next.js/bundler build-time error for any `'use client'` component to import runtime values from `@repo/app-providers`. Type-only imports (`import type { ... }`) are erased before the bundler runs — `NormalizedInstallation`, `ProviderDefinition`, etc. used as types in client files are unaffected.

**Changes B — Add new exports**:

```typescript
// New exports from define.ts
export { authKindSchema, providerKindSchema } from "./define";
export type { AuthKind, ProviderKind } from "./define";

// Updated display exports — ProviderDisplayEntry is now Zod-inferred
export { providerDisplayEntrySchema } from "./display";
export type { ProviderDisplayEntry } from "./display";
```

**Changes C — Remove stale re-exports**: `ProviderName`, `SourceType`, and `sourceTypeSchema` in the registry re-export block now resolve through the canonical `providerSlugSchema` chain — verify no duplicate exports remain.

---

#### 6. Update client components to use `./display` subpath

The following `'use client'` components currently import runtime display values from the barrel (`@repo/app-providers`). After adding `server-only`, these become build errors. Update each to use `@repo/app-providers/display`:

**`sources/new/_components/link-sources-button.tsx`**:
```typescript
// Before: import { PROVIDER_SLUGS } from "@repo/app-providers";
import { PROVIDER_SLUGS } from "@repo/app-providers/display";
```

**`sources/new/_components/provider-source-item.tsx`**:
```typescript
// Before: import { PROVIDER_DISPLAY, type ProviderSlug } from "@repo/app-providers";
import { PROVIDER_DISPLAY, type ProviderSlug } from "@repo/app-providers/display";
```

**`sources/new/_components/sources-section.tsx`**:
```typescript
// Before: import { PROVIDER_DISPLAY, PROVIDER_SLUGS } from "@repo/app-providers";
import { PROVIDER_DISPLAY, PROVIDER_SLUGS } from "@repo/app-providers/display";
```

**`sources/new/_components/sources-section-loading.tsx`**:
```typescript
// Before: import { PROVIDER_SLUGS } from "@repo/app-providers";
import { PROVIDER_SLUGS } from "@repo/app-providers/display";
```

After these 4 updates, build both packages to confirm no missed client imports:
```bash
pnpm --filter @repo/app-providers build
pnpm build:console
```

---

#### 7. Delete `display-sync.test.ts`

**File**: `packages/console-providers/src/__tests__/display-sync.test.ts`

Delete entirely. The two assertions it made are now enforced at the type level:
1. `PROVIDER_DISPLAY` keys match `PROVIDERS` keys → structurally guaranteed: providers spread from `PROVIDER_DISPLAY` (spread site fails if key missing) + `_AssertDisplayComplete` assertion (PROVIDERS missing entry → compile error)
2. `name`, `displayName`, `description` match between the two → impossible to diverge (single source via spread)

---

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] All tests pass: `pnpm --filter @repo/app-providers test` (`display-sync.test.ts` deleted)
- [ ] Console app builds without error: `pnpm build:console`
- [x] `providerSlugSchema` is importable from `@repo/app-providers/display` at runtime
- [x] `z.infer<typeof providerSlugSchema>` equals `"apollo" | "github" | "linear" | "sentry" | "vercel"`
- [x] `ProviderName`, `SourceType`, `ProviderSlug` are structurally identical at the type level
- [x] `PROVIDERS.github.icon` resolves to `IconDef` at the type level
- [x] `PROVIDERS.sentry.comingSoon` resolves to `true` at the type level
- [x] `ProviderAccountInfo` inferred type still includes all 5 provider account info variants
- [x] `ProviderConfig` inferred type still includes all 5 provider config variants
- [x] Runtime: `providerSlugSchema.parse("github")` succeeds; `providerSlugSchema.parse("unknown")` throws
- [x] Runtime: `providerDisplayEntrySchema.parse(PROVIDER_DISPLAY.github)` succeeds
- [x] Completeness: adding a dummy live entry to `PROVIDER_DISPLAY` (no `comingSoon`) without a `PROVIDERS` entry causes a TypeScript error naming the missing slug
- [x] Completeness: spreading `...PROVIDER_DISPLAY.nonExistent` in a provider definition causes a TypeScript error
- [x] Boundary: adding `import { PROVIDERS } from "@repo/app-providers"` to any `'use client'` file causes a build error (verify temporarily)
- [x] `providerKindSchema.parse("webhook")` succeeds; `providerKindSchema.parse("managed")` throws (Phase 9 adds it)
- [x] `authKindSchema.parse("app-token")` succeeds; `authKindSchema.parse("unknown")` throws

#### Manual Verification:
- [ ] Console UI provider list still renders correctly — `display.ts` data is unchanged, only the sync mechanism changed
- [ ] No regression in sources/new flow, events filter, or debug panel
- [ ] Server components importing from the barrel still compile and render correctly

**Implementation Note**: Phase 4 is the largest phase in the plan. Implement in this order to minimize compilation noise: (1) `display.ts` changes, (2) `define.ts` changes, (3) provider spreads, (4) `registry.ts` changes (including Step 8 below), (5) `index.ts` server-only + exports, (6) client component fixes, (7) delete `display-sync.test.ts`. After all automated verification passes, pause for manual confirmation before proceeding.

---

#### 8. Phantom Provider Graph — Type-Level Consumer Contracts

**Files**: `packages/console-providers/src/display.ts`, `packages/console-providers/src/registry.ts`, `packages/console-providers/src/index.ts`

This step adds four interlocking mechanisms that close the type loop across package boundaries. The collective property: **every consumer gets narrow provider types with zero runtime coupling to `PROVIDERS`**.

---

**Step 8A — Brand `providerSlugSchema`**

`ProviderSlug` becomes a nominal type. Raw `"github"` strings cannot be passed where `ProviderSlug` is required — they must be validated through the schema first. The brand propagates through all derived types (`ProviderName`, `SourceType`, `EventKey`).

**File**: `packages/console-providers/src/display.ts`

```typescript
// Append .brand<"ProviderSlug">() to the existing providerSlugSchema declaration
export const providerSlugSchema = z.enum(
  Object.keys(PROVIDER_DISPLAY) as [keyof typeof PROVIDER_DISPLAY, ...]
).brand<"ProviderSlug">()
  .meta({ id: "ProviderSlug", description: "Canonical provider slug — validated nominal type" });

export type ProviderSlug = z.infer<typeof providerSlugSchema>;
// → ("apollo" | "github" | "linear" | "sentry" | "vercel") & { readonly [Symbol]: "ProviderSlug" }
```

---

**Step 8B — Mapped `EventKey` type + `eventKeySchema` Zod enum**

`EventKey` is currently a string union maintained by hand (or derived runtime-only). This replaces it with a **compile-time mapped type** derived directly from `PROVIDERS[K]["events"]` keys — and a **Zod enum** derived from the same source at module load. The two stay structurally identical by construction.

**File**: `packages/console-providers/src/registry.ts`

```typescript
// ── EventKey — compile-time mapped type ──────────────────────────────────────
// Auto-derived from PROVIDERS.*.events keys. Zero manual maintenance.
// Updating PROVIDERS automatically updates EventKey and eventKeySchema.
export type EventKey = {
  [K in keyof typeof PROVIDERS & string]:
    (typeof PROVIDERS)[K] extends { events: Record<infer E extends string, unknown> }
      ? `${K}.${E}`
      : never;
}[keyof typeof PROVIDERS & string];
// → "github.pull_request" | "github.issues" | "linear.issue" | "linear.comment" | ...

// ── eventKeySchema — runtime twin of EventKey ─────────────────────────────────
// Same derivation path, so compile-time and runtime representations are always in sync.
const _eventKeys = Object.entries(PROVIDERS).flatMap(([slug, p]) =>
  "events" in p && p.events
    ? Object.keys(p.events).map((e) => `${slug}.${e}`)
    : []
) as [EventKey, ...EventKey[]];

export const eventKeySchema = z.enum(_eventKeys);
// eventKeySchema.parse("github.pull_request") → EventKey ✓
// eventKeySchema.parse("github.fake")         → ZodError ✗

export type EventKey = z.infer<typeof eventKeySchema>; // alias — same type
```

> **Note**: Replace the existing `EventKey` string-union derivation with this mapped type. The `EVENT_REGISTRY` keys type is updated to use `EventKey` from here — no other registry changes needed.

---

**Step 8C — `ProviderShape<K>` + derived utility types**

Type utilities that let consumer packages (relay, gateway, backfill) reference exact per-provider types **without importing the runtime `PROVIDERS` object**. Type-only imports are erased before bundling — zero dependency graph pollution.

**File**: `packages/console-providers/src/registry.ts`

```typescript
// ── Phantom Provider Graph — type utilities for zero-runtime consumer coupling ──
//
// Usage in any consumer:
//   import type { ProviderShape, AuthDefFor } from "@repo/app-providers";
//   type GitHubAuth = AuthDefFor<"github">; // → AppTokenDef
//   (type-only import — erased before bundling, zero runtime cost)

/** Exact type of a provider by slug — narrows to the specific provider object shape. */
export type ProviderShape<K extends keyof typeof PROVIDERS> = (typeof PROVIDERS)[K];

/** Exact auth definition for a provider by slug. */
export type AuthDefFor<K extends keyof typeof PROVIDERS> =
  ProviderShape<K> extends { readonly auth: infer A } ? A : never;

/** Inferred account info type for a provider by slug. */
export type AccountInfoFor<K extends keyof typeof PROVIDERS> =
  ProviderShape<K> extends { accountInfoSchema: z.ZodType<infer A> } ? A : never;

/** Union of event key suffixes available for a provider by slug. */
export type EventKeysFor<K extends keyof typeof PROVIDERS> =
  ProviderShape<K> extends { events: Record<infer E extends string, unknown> } ? E : never;
```

Consumer example (gateway, zero runtime import):
```typescript
// apps/gateway/src/handlers/github.ts
import type { AuthDefFor, AccountInfoFor } from "@repo/app-providers";
// ↑ TYPE IMPORT ONLY — erased before bundling

type GitHubAuth    = AuthDefFor<"github">;     // → AppTokenDef (narrow, exact)
type GitHubInfo    = AccountInfoFor<"github">; // → GitHubAccountInfo
type GitHubEvents  = EventKeysFor<"github">;   // → "pull_request" | "issues"
```

---

**Step 8D — Narrow `getProvider<K>` overload**

A single overload addition to `getProvider` — callers with a literal slug argument receive the exact provider type, not the wide `ProviderDefinition`. No casts, no assertions required anywhere in the codebase.

**File**: `packages/console-providers/src/registry.ts`

```typescript
/** Narrow overload: literal slug → exact provider shape. */
export function getProvider<K extends keyof typeof PROVIDERS>(slug: K): ProviderShape<K>;
/** Wide overload: runtime ProviderSlug → union ProviderDefinition. */
export function getProvider(slug: ProviderSlug): ProviderDefinition;
export function getProvider(slug: string): ProviderDefinition {
  const p = PROVIDERS[slug as keyof typeof PROVIDERS];
  if (!p) throw new Error(`Unknown provider: ${slug}`);
  return p;
}

// Call-site behaviour:
// getProvider("github").auth.kind         → "app-token"  (narrow, no cast)
// getProvider("github").auth.getAppToken  → function     (exists on AppTokenDef only)
// getProvider("linear").auth.kind         → "oauth"      (narrow)
// getProvider(runtimeSlug).auth.kind      → "oauth" | "api-key" | "app-token" (correctly wide)
```

---

**Step 8E — Export from `index.ts`**

```typescript
// Add to index.ts exports:
export { eventKeySchema } from "./registry";
export type {
  AccountInfoFor,
  AuthDefFor,
  EventKeysFor,
  ProviderShape,
} from "./registry";
```

---

### The Closed Type Loop

```
providerSlugSchema.brand<"ProviderSlug">()  ← nominal slug — only from schema.parse()
  ↓
PROVIDERS[K]                                ← constrained via as const + _AssertDisplayComplete
  ↓
EventKey mapped from PROVIDERS[K]["events"] ← compile-time, auto-updates with PROVIDERS
eventKeySchema derived from same source     ← runtime twin, structurally identical
  ↓
ProviderShape<K>, AuthDefFor<K>,            ← zero-runtime consumer contracts
AccountInfoFor<K>, EventKeysFor<K>          ← type-only imports, erased before bundling
  ↓
getProvider<K>                              ← propagates narrow types at runtime
  ↓
Adding a provider touches ONE file.         ← entire graph updates automatically.
```

**The key invariant**: compile-time types and runtime validators are derived from the same source (`PROVIDERS`). They cannot diverge. TypeScript errors on invalid event keys at the call site. Zod throws on invalid event keys at ingestion time. Both enforce the same set.

### Additional Success Criteria (Step 8):

#### Automated Verification:
- [ ] `type T = AuthDefFor<"github">` resolves to `AppTokenDef` (not `OAuthDef | ApiKeyDef | AppTokenDef`)
- [ ] `type T = AuthDefFor<"linear">` resolves to `OAuthDef`
- [ ] `type T = EventKeysFor<"github">` resolves to `"pull_request" | "issues"`
- [ ] `getProvider("github").auth.kind` resolves to `"app-token"` at the type level (no cast needed)
- [ ] `getProvider("github").auth.getAppToken` type-checks as a function (AppTokenDef field)
- [ ] `eventKeySchema.parse("github.pull_request")` succeeds at runtime
- [ ] `eventKeySchema.parse("github.nonexistent")` throws at runtime
- [ ] `type T = EventKey` equals the union of all `"${slug}.${event}"` combinations across PROVIDERS
- [ ] `import type { ProviderShape } from "@repo/app-providers"` in a `'use client'` file does NOT cause a build error (type-only import is erased before server-only check)
- [ ] `import { getProvider } from "@repo/app-providers"` in a `'use client'` file DOES cause a build error
- [ ] Adding a new event key to a provider's `events` map automatically adds `"${slug}.${newEvent}"` to `EventKey` and `eventKeySchema` — verified by `pnpm typecheck`
- [ ] `providerSlugSchema.parse("github")` returns a branded `ProviderSlug`, not a plain string
- [ ] Passing `"github"` (unbranded) directly to a function typed `(slug: ProviderSlug) => void` causes a TypeScript error

#### Manual Verification:
- [ ] Gateway auth handlers reference `AuthDefFor<"github">` instead of manual type casts — confirm with `grep -r "as AppTokenDef\|as OAuthDef" apps/gateway/`

---

## Phase 5: Registry 1-Touch — Remove ProviderConfigMap + Auto-Derive Unions

> **ABSORBED into Phase 4** — The `ProviderConfigMap` removal, auto-derived discriminated unions, and 1-touch provider registration are all implemented as part of the Zod-First Registry Unification in Phase 4. This phase has no remaining work.

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
- [ ] All tests pass: `pnpm --filter @repo/app-providers test`
- [ ] `ProviderAccountInfo` inferred type still includes all 5 provider account info variants
- [ ] `ProviderConfig` inferred type still includes all 5 provider config variants

#### Manual Verification:
- [ ] Adding a hypothetical 6th provider requires only adding it to `PROVIDERS` — no other files need manual updates (verify by code inspection)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation.

---

## Phase 6: Gateway.ts Split + define.ts Absorption

### Overview

Split `gateway.ts` (222 lines, 4 mixed concerns) into focused files **and** absorb the proxy wire types and backfill depth primitive into `define.ts` where they conceptually belong. The decisive signal: `define.ts:4` already imports `ProxyExecuteResponse` from `gateway.ts` — the cross-file import is the type system pointing to the correct home.

**End state**: `gateway.ts` shrinks to ~50 lines (3 gateway API response schemas). `define.ts` gains 6 exports. Two new focused files (`wire.ts`, `backfill-contracts.ts`). Zero breaking changes via barrel.

> Research basis: `thoughts/shared/research/2026-03-18-gateway-ts-unification-into-define-ts.md`

### Schema Mapping

```
gateway.ts (222 lines)
  │
  ├── proxyExecuteRequestSchema + ProxyExecuteRequest     → define.ts
  ├── proxyExecuteResponseSchema + ProxyExecuteResponse   → define.ts  (define.ts already imports it)
  ├── backfillDepthSchema + BACKFILL_DEPTH_OPTIONS        → define.ts  (primitive of BackfillDef)
  │
  ├── serviceAuthWebhookBodySchema + ServiceAuthWebhookBody   → wire.ts (relay-only)
  ├── webhookReceiptPayloadSchema + WebhookReceiptPayload     → wire.ts (relay-only)
  ├── webhookEnvelopeSchema + WebhookEnvelope                 → wire.ts (relay-only)
  │
  ├── gwInstallationBackfillConfigSchema + GwInstallationBackfillConfig → backfill-contracts.ts
  ├── backfillRunStatusSchema (internal)                              → backfill-contracts.ts
  ├── backfillTerminalStatusSchema + BACKFILL_TERMINAL_STATUSES       → backfill-contracts.ts
  ├── backfillTriggerPayload + BackfillTriggerPayload                 → backfill-contracts.ts
  ├── backfillEstimatePayload + BackfillEstimatePayload               → backfill-contracts.ts
  ├── backfillRunRecord + BackfillRunRecord                           → backfill-contracts.ts
  ├── backfillRunReadRecord + BackfillRunReadRecord                   → backfill-contracts.ts
  │
  └── gatewayConnectionSchema + GatewayConnection         → gateway.ts (kept)
      gatewayTokenResultSchema + GatewayTokenResult        → gateway.ts (kept)
      proxyEndpointsResponseSchema + ProxyEndpointsResponse→ gateway.ts (kept)
```

### Changes Required:

#### 1. Absorb proxy types + depth into `define.ts`
**File**: `packages/console-providers/src/define.ts`
**Changes**:
- Delete `import type { ProxyExecuteResponse } from "./gateway"` (line 4) — no longer needed
- Add after `rateLimitSchema` (before the Backfill schemas section):

```typescript
// ── Proxy Wire Types ─────────────────────────────────────────────────────────

export const proxyExecuteRequestSchema = z.object({
  endpointId: z.string(),
  pathParams: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
});
export type ProxyExecuteRequest = z.infer<typeof proxyExecuteRequestSchema>;

export const proxyExecuteResponseSchema = z.object({
  status: z.number(),
  data: z.unknown(),
  headers: z.record(z.string(), z.string()),
});
export type ProxyExecuteResponse = z.infer<typeof proxyExecuteResponseSchema>;
```

- Add before `backfillWebhookEventSchema` (in the Backfill schemas section):

```typescript
export const backfillDepthSchema = z.union([
  z.literal(1),
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);
export type BackfillDepth = z.infer<typeof backfillDepthSchema>;

/** Ordered options for UI depth selectors. */
export const BACKFILL_DEPTH_OPTIONS = [1, 7, 30, 90] as const satisfies readonly z.infer<typeof backfillDepthSchema>[];
```

#### 2. Create `wire.ts`
**File**: `packages/console-providers/src/wire.ts` (new)
**Contents**: Move from `gateway.ts` + add `sourceTypeSchema` import:
- `serviceAuthWebhookBodySchema` + `ServiceAuthWebhookBody`
- `webhookReceiptPayloadSchema` + `WebhookReceiptPayload`
- `webhookEnvelopeSchema` + `WebhookEnvelope`

```typescript
import { z } from "zod";
import { sourceTypeSchema } from "./registry";
// ... moved schemas
```

#### 3. Create `backfill-contracts.ts`
**File**: `packages/console-providers/src/backfill-contracts.ts` (new)
**Contents**: Move from `gateway.ts` + import `backfillDepthSchema` from `define.ts`:
- `gwInstallationBackfillConfigSchema` + `GwInstallationBackfillConfig`
- `backfillRunStatusSchema` (internal)
- `backfillTerminalStatusSchema` + `BACKFILL_TERMINAL_STATUSES`
- `backfillTriggerPayload` + `BackfillTriggerPayload`
- `backfillEstimatePayload` + `BackfillEstimatePayload`
- `backfillRunRecord` + `BackfillRunRecord`
- `backfillRunReadRecord` + `BackfillRunReadRecord`

```typescript
import { z } from "zod";
import { backfillDepthSchema } from "./define";  // depth now lives in define
import { sourceTypeSchema } from "./registry";
// ... moved schemas
```

#### 4. Trim `gateway.ts`
**File**: `packages/console-providers/src/gateway.ts`
**Contents**: Keep only (~50 lines):
- `gatewayConnectionSchema` + `GatewayConnection`
- `gatewayTokenResultSchema` + `GatewayTokenResult`
- `proxyEndpointsResponseSchema` + `ProxyEndpointsResponse`

Remove `import { sourceTypeSchema } from "./registry"` (no longer needed after trim).

#### 5. Update `index.ts` barrel
**File**: `packages/console-providers/src/index.ts`
**Changes**:
- Add `wire.ts` re-export block (after `gateway.ts` block)
- Add `backfill-contracts.ts` re-export block
- Move `backfillDepthSchema`, `BACKFILL_DEPTH_OPTIONS`, `proxyExecuteRequestSchema`, `proxyExecuteResponseSchema`, `ProxyExecuteRequest`, `ProxyExecuteResponse` to the `./define` re-export block
- Remove those same names from the `./gateway` re-export block

Zero breaking changes — all names remain accessible via `@repo/app-providers`.

#### 6. Update consuming app imports (optional — barrel covers all)

Apps import via `@repo/app-providers` barrel so no import changes are strictly required. However, for direct internal imports within `console-providers`:
- `packages/gateway-service-clients/src/gateway.ts` — update to import from `@repo/app-providers` (or directly from `gateway.ts`, `define.ts` as needed)
- Any `console-providers`-internal files importing `backfillDepthSchema` from `gateway.ts` → update to `define.ts`

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] All tests pass across all apps: `pnpm --filter @repo/app-providers test` (356 passed, 11 files)
- [x] `gateway.ts` contains only `gatewayConnectionSchema`, `gatewayTokenResultSchema`, `proxyEndpointsResponseSchema`
- [x] `define.ts` no longer imports from `./gateway` (line 4 deleted)
- [x] `proxyExecuteResponseSchema.parse(...)` accessible via `@repo/app-providers`
- [x] `backfillDepthSchema.parse(1)` accessible via `@repo/app-providers`

#### Manual Verification:
- [ ] Relay still processes webhooks correctly
- [ ] Backfill triggers still work
- [ ] Gateway connections API still responds correctly
- [ ] Resource picker (sources/new) still loads installation data

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
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] All tests pass: `pnpm --filter @repo/app-providers test`
- [x] `webhookSecretEnvKey` map no longer exists in the codebase

#### Manual Verification:
- [ ] All 4 webhook providers' signatures verify correctly via relay (test with ngrok + real webhooks)
- [ ] Adding a new webhook provider to `PROVIDERS` automatically works in relay without relay code changes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that webhook verification works.

---

## Phase 8: Server-Only Boundary Enforcement

> **ABSORBED into Phase 4** — The `import "server-only"` hard boundary on `index.ts` and migration of client components to `./display` subpath imports are part of the Zod-First Registry Unification in Phase 4. This phase has no remaining work.

### Overview
With `display.ts` already the client-safe registry (Phase 4), this phase installs a hard build-time boundary. Add `import "server-only"` to `index.ts` — any client component importing runtime values from the barrel `@repo/app-providers` now fails at build time, not silently at runtime. Update the 4 client components that currently import runtime values from the barrel to use the `./display` subpath instead. Drop the original `ClientShape`/`PROVIDER_CLIENT_REGISTRY` scope — not needed.

**Why `server-only` and not export conditions**: Export conditions (`react-server`/`default`) would silently change what client code sees. `server-only` fails loudly at build time with a clear "you imported a server module" error, which is the right DX for this boundary.

**What `server-only` does NOT block**: `import type { ... }` — type-only imports are erased before the bundler sees them. `NormalizedInstallation`, `NormalizedResource`, and `ProviderDefinition` used as types in client files continue to work. Only runtime value imports (`PROVIDER_DISPLAY`, `PROVIDER_SLUGS`, `PROVIDERS`, etc.) from the barrel trigger the error.

### Changes Required:

#### 1. Add `server-only` dependency
**File**: `packages/console-providers/package.json`
**Changes**:
```bash
pnpm --filter @repo/app-providers add server-only
```

#### 2. Add `import "server-only"` to `index.ts`
**File**: `packages/console-providers/src/index.ts`
**Changes**: Add as the very first line:

```typescript
import "server-only";
// ... rest of barrel unchanged
```

This makes it a Next.js build-time error for any client component to import runtime values from `@repo/app-providers`.

#### 3. Update 4 client components importing runtime values from the barrel
The following `'use client'` components import runtime display values (`PROVIDER_DISPLAY`, `PROVIDER_SLUGS`) from `@repo/app-providers` (barrel) instead of `@repo/app-providers/display`. These must change:

**`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/link-sources-button.tsx`**:
```typescript
// Before:
import { PROVIDER_SLUGS } from "@repo/app-providers";
// After:
import { PROVIDER_SLUGS } from "@repo/app-providers/display";
```

**`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/provider-source-item.tsx`**:
```typescript
// Before:
import { PROVIDER_DISPLAY, type ProviderSlug } from "@repo/app-providers";
// After:
import { PROVIDER_DISPLAY, type ProviderSlug } from "@repo/app-providers/display";
```

**`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/sources-section.tsx`**:
```typescript
// Before:
import { PROVIDER_DISPLAY, PROVIDER_SLUGS } from "@repo/app-providers";
// After:
import { PROVIDER_DISPLAY, PROVIDER_SLUGS } from "@repo/app-providers/display";
```

**`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/sources-section-loading.tsx`**:
```typescript
// Before:
import { PROVIDER_SLUGS } from "@repo/app-providers";
// After:
import { PROVIDER_SLUGS } from "@repo/app-providers/display";
```

**Note**: `source-selection-provider.tsx` imports `import type { NormalizedInstallation, NormalizedResource, ProviderSlug }` — type-only imports are erased, no change needed.

#### 4. Verify no other client component imports runtime values from the barrel
After the 4 updates above, run:
```bash
pnpm --filter @repo/app-providers build
pnpm --filter @repo/console build
```
A build error points to a missed client import. All server components and API code importing from the barrel remain unchanged.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/app-providers test`
- [ ] Console app builds without error: `pnpm build:console`
- [ ] Type assertion: adding `import { PROVIDER_DISPLAY } from "@repo/app-providers"` to any `'use client'` file causes a build error (verify by temporarily adding to a test client component)

#### Manual Verification:
- [ ] Console UI still renders provider icons, names, and slugs correctly (display data unchanged)
- [ ] No regression in sources/new flow, events filter, or debug panel

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation.

---

## Phase 9: ManagedProvider Type Architecture

### Overview
Add the complete type architecture for `ManagedProvider` as a third provider tier — interfaces, type guards, factory, schema updates, and exports — **without** any runtime wiring (no DB migration, no relay changes, no gateway changes). This establishes all the type scaffolding so that when a concrete managed provider (HubSpot, Stripe) is added, the runtime wiring is a focused follow-up with zero type-level design decisions remaining.

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

#### 3. Update `providerKindSchema`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add `"managed"` to the enum at line 18:

```typescript
// Before:
export const providerKindSchema = z.enum(["webhook", "api"]);

// After:
export const providerKindSchema = z.enum(["webhook", "managed", "api"]);
```

#### 4. Update `ProviderDefinition` union
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add `ManagedProvider` to the union:

```typescript
export type ProviderDefinition<...> =
  | WebhookProvider<...>
  | ManagedProvider<...>
  | ApiProvider<...>;
```

#### 5. Add type guards
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

#### 6. Add `defineManagedProvider` factory
**File**: `packages/console-providers/src/define.ts`
**Changes**: Add after `defineApiProvider`. Constrain the injected `kind` via `satisfies` (same pattern as `defineWebhookProvider` and `defineApiProvider`):

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
    kind: ("managed" as const) satisfies z.infer<typeof providerKindSchema>,
    get env(): Record<string, string> {
      _env ??= buildEnvGetter(def.envSchema);
      return _env;
    },
  }) as ManagedProvider<TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema>;
}
```

#### 7. Update exports
**File**: `packages/console-providers/src/index.ts`
**Changes**: Export `ManagedProvider`, `ManagedWebhookDef`, `WebhookSetupDef`, `WebhookSetupState`, `webhookSetupStateSchema`, `defineManagedProvider`, `isManagedProvider`, `hasInboundWebhooks`.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (pre-existing errors in connections.ts only)
- [x] Lint passes: `pnpm check` (pre-existing errors in apps/console only; console-providers clean)
- [x] All tests pass: `pnpm --filter @repo/app-providers test` (356 passed)
- [x] `ProviderDefinition` union includes 3 members (WebhookProvider, ManagedProvider, ApiProvider)
- [x] `providerKindSchema.parse("managed")` succeeds at runtime
- [x] Type assertion: `isManagedProvider({ kind: "managed" })` returns `true`
- [x] Type assertion: `hasInboundWebhooks({ kind: "webhook" })` and `hasInboundWebhooks({ kind: "managed" })` both return `true`
- [x] Type assertion: `hasInboundWebhooks({ kind: "api" })` returns `false`
- [x] Existing 5 providers in `PROVIDERS` still typecheck and function unchanged (no managed providers exist yet — this is type architecture only)

#### Manual Verification:
- [ ] Existing webhook providers continue to work unchanged (zero runtime changes in this phase)

**Implementation Note**: This phase is purely type-level — zero runtime changes, zero DB changes, zero consumer changes (relay, gateway remain untouched). The relay still uses `isWebhookProvider` as its guard; migrating to `hasInboundWebhooks` is deferred to when the first managed provider is added. After all automated verification passes, proceed to Phase 10.

---

## Phase 10: Complete Provider Type Coverage

### Overview
Exercise every extension point built in Phases 1-9 by completing the remaining research schemas. Three schema extensions — no provider implementations, no runtime infrastructure, no DB migrations. After this phase, every provider identified in the research taxonomy (`thoughts/shared/research/2026-03-17-provider-architecture-redesign.md`) has a typed home in the `ProviderDefinition` union. Future providers are fill-in-the-blank against stable interfaces.

**Depends on**: Phase 3 (extends `SignatureScheme` union), Phase 9 (`hasInboundWebhooks` guard gets updated).

### Changes Required:

#### 1. Widen `WebhookProvider.auth` to `AuthDef`
**Files**: `packages/console-providers/src/provider/shape.ts` (WebhookProvider interface), `packages/console-providers/src/factory/webhook.ts` (factory generic)
**Changes**: Change the `TAuth` constraint on `WebhookProvider` from `OAuthDef | AppTokenDef` to `AuthDef` (includes `ApiKeyDef`). Same change on `defineWebhookProvider` factory's `TAuth` generic.

```typescript
// Before (Phase 1):
export interface WebhookProvider<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TAuth extends
    | OAuthDef<TConfig, TAccountInfo>
    | AppTokenDef<TConfig, TAccountInfo> =
    | OAuthDef<TConfig, TAccountInfo>
    | AppTokenDef<TConfig, TAccountInfo>,
  ...
>

// After:
export interface WebhookProvider<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TAuth extends AuthDef<TConfig, TAccountInfo> = AuthDef<TConfig, TAccountInfo>,
  ...
>
```

This is a widening — existing providers (all `OAuthDef` or `AppTokenDef`) continue to infer their narrow types. The factory's `const` inference preserves literal types. No consumer changes needed.

**Unlocks**: Stripe (API key + HMAC webhook).

#### 2. Add `InboundWebhookDef` and optional `inbound` on `ApiProvider`
**Files**: `packages/console-providers/src/provider/webhook.ts` (`InboundWebhookDef` interface), `packages/console-providers/src/provider/shape.ts` (`ApiProvider.inbound` field)
**Changes**: Add `InboundWebhookDef` interface after `WebhookDef`. Add optional `inbound` field to `ApiProvider`.

```typescript
/**
 * Inbound webhook reception for API providers.
 * For providers that use API-key auth but also receive webhooks
 * configured manually by the customer (Clerk via Svix, Datadog alerts).
 * No programmatic registration — that's ManagedProvider's job.
 */
export interface InboundWebhookDef<TConfig> {
  readonly webhook: WebhookDef<TConfig>;
}
```

Add to `ApiProvider`:
```typescript
export interface ApiProvider<...> extends BaseProviderFields<...> {
  readonly auth: AuthDef<TConfig, TAccountInfo>;
  readonly backfill?: BackfillDef;
  /** Optional inbound webhook reception — for API-key providers with manual webhook setup */
  readonly inbound?: InboundWebhookDef<TConfig>;
  readonly kind: "api";
}
```

#### 3. Update `hasInboundWebhooks` type guard
**File**: `packages/console-providers/src/provider/shape.ts`
**Changes**: Extend the guard (defined in Phase 9) to also match `ApiProvider` with `inbound`:

```typescript
type ProviderWithInboundWebhooks =
  | WebhookProvider
  | ManagedProvider
  | (ApiProvider & { readonly inbound: InboundWebhookDef<unknown> });

export function hasInboundWebhooks(
  p: ProviderDefinition
): p is ProviderWithInboundWebhooks {
  if (p.kind === "webhook" || p.kind === "managed") return true;
  if (p.kind === "api" && p.inbound != null) return true;
  return false;
}
```

The relay's `providerGuard` (updated in Phase 9 to use `hasInboundWebhooks`) automatically gains `ApiProvider`-with-inbound support — no relay changes needed.

**Unlocks**: Clerk (API key + Ed25519 webhook), Datadog (API key + HMAC webhook alerts).

#### 4. Add Ed25519 to `SignatureScheme`
**Files**: `packages/console-providers/src/provider/webhook.ts` (schema + `ed25519` factory), `packages/console-providers/src/runtime/verify/ed25519.ts` (implementation), `packages/console-providers/src/runtime/verify/index.ts` (dispatch)
**Changes**: Add `ed25519SchemeSchema` as a second variant in the `signatureSchemeSchema` discriminated union. Add `case "ed25519"` to `deriveVerifySignature`. Add `@noble/ed25519` dependency.

```typescript
const ed25519SchemeSchema = z.object({
  kind: z.literal("ed25519"),
  signatureHeader: z.string(),
  timestampHeader: z.string().optional(),
  /** Svix-style: multiple space-separated base64 signatures, any must match */
  multiSignature: z.boolean().optional(),
});

export const signatureSchemeSchema = z.discriminatedUnion("kind", [
  hmacSchemeSchema,
  ed25519SchemeSchema,  // NEW
]);

export type Ed25519Scheme = z.infer<typeof ed25519SchemeSchema>;
// SignatureScheme and HmacScheme types auto-update via inference
```

Add Ed25519 factory:
```typescript
export const ed25519 = <const T extends Omit<Ed25519Scheme, "kind">>(
  opts: T
): { readonly kind: "ed25519" } & T => ({ kind: "ed25519", ...opts });
```

Add case to `deriveVerifySignature`:
```typescript
export function deriveVerifySignature(scheme: SignatureScheme): VerifyFn {
  switch (scheme.kind) {
    case "hmac": return _deriveHmacVerify(scheme);
    case "ed25519": return _deriveEd25519Verify(scheme);
  }
}

function _deriveEd25519Verify(scheme: Ed25519Scheme): VerifyFn {
  return async (rawBody, headers, secret) => {
    const rawSig = headers.get(scheme.signatureHeader);
    if (!rawSig) return false;
    // Svix sends space-separated base64 signatures; any must match
    const signatures = scheme.multiSignature
      ? rawSig.split(" ")
      : [rawSig];
    const secretBytes = base64ToUint8Array(secret);
    const messageBytes = scheme.timestampHeader
      ? new TextEncoder().encode(
          `${headers.get(scheme.timestampHeader)}.${rawBody}`
        )
      : new TextEncoder().encode(rawBody);
    for (const sig of signatures) {
      const sigBytes = base64ToUint8Array(sig);
      if (await ed25519.verify(sigBytes, messageBytes, secretBytes)) {
        return true;
      }
    }
    return false;
  };
}
```

**Note**: `deriveVerifySignature` return type widens from `(rawBody, headers, secret) => boolean` to `(rawBody, headers, secret) => boolean | Promise<boolean>`. The `VerifyFn` type alias and relay signature verification must be updated to `await` the result. This is a small but important change — verify relay compatibility.

**Unlocks**: Clerk/Svix (`ed25519({ signatureHeader: "svix-signature", timestampHeader: "svix-timestamp", multiSignature: true })`), Discord.

#### 5. Update `defineApiProvider` factory
**File**: `packages/console-providers/src/factory/api.ts`
**Changes**: The factory's `Omit<ApiProvider<...>, "env" | "kind">` already accepts optional fields naturally. No explicit change needed — `inbound?` flows through the spread. Verify the factory's return type includes `inbound`.

#### 6. Update exports
**File**: `packages/console-providers/src/index.ts`
**Changes**: Add:
```typescript
export { ed25519 } from "./define";
export type { Ed25519Scheme, InboundWebhookDef } from "./define";
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm check`
- [x] All tests pass: `pnpm --filter @repo/app-providers test`
- [x] Type assertion: `WebhookProvider` accepts `ApiKeyDef` in `auth` position (compile-time test)
- [x] Type assertion: existing providers still infer narrow auth types (GitHub → `AppTokenDef`, Linear → `OAuthDef`)
- [x] Type assertion: `ApiProvider` with `inbound: InboundWebhookDef` passes `hasInboundWebhooks` guard
- [x] Type assertion: `ApiProvider` without `inbound` does NOT pass `hasInboundWebhooks` guard
- [x] Runtime validation: `signatureSchemeSchema.parse({ kind: "ed25519", signatureHeader: "svix-signature" })` succeeds
- [x] Runtime validation: `signatureSchemeSchema.parse({ kind: "hmac", algorithm: "sha256", signatureHeader: "x-hub-signature-256" })` still succeeds (no regression)
- [x] Exhaustiveness: `deriveVerifySignature` switch covers both `"hmac"` and `"ed25519"` — no TypeScript error
- [x] Exhaustiveness: temporarily adding a third `kind` to the union causes a TypeScript error in `deriveVerifySignature` (validates extension protocol)

#### Manual Verification:
- [ ] Existing 4 webhook providers still verify signatures correctly (HMAC path unchanged)
- [ ] No bundle size regression in client-side code (Ed25519 dependency is server-only)

**Implementation Note**: No provider implementations in this phase — only interface and schema definitions. The schemas are validated by type-level and runtime-validation tests, not by wiring real providers. After completing this phase and all automated verification passes, every provider in the research taxonomy can be typed without architecture changes.

---

## Testing Strategy

### Unit Tests:
- `define.ts` — Test `deriveVerifySignature` with all HMAC variants (SHA-256, SHA-1, SHA-512) and with/without prefix
- `registry.ts` — Test auto-derived `providerAccountInfoSchema` validates all 5 provider account infos
- `registry.ts` — Test auto-derived `providerConfigSchema` validates all 5 provider configs
- Each provider — Test `signatureScheme` round-trips through `signatureSchemeSchema.parse()`
- `define.ts` — Test `connectionStatusSchema.parse()` for all 3 statuses
- `define.ts` — Test `deriveVerifySignature` with Ed25519 scheme (Phase 10)
- `define.ts` — Test `signatureSchemeSchema.parse()` for both HMAC and Ed25519 variants (Phase 10)

### Integration Tests:
- Relay — Webhook signature verification with real provider signature headers
- Gateway — OAuth/App-Token callback flow end-to-end
- Gateway — Managed provider setup.register() + teardown (deferred — no managed providers exist yet)

### Type-Level Tests:
```typescript
type Assert<T, U extends T> = true;
type _1 = Assert<(typeof PROVIDERS)["github"]["auth"]["kind"], "app-token">;
type _2 = Assert<(typeof PROVIDERS)["github"]["auth"]["usesStoredToken"], false>;
type _3 = Assert<(typeof PROVIDERS)["apollo"]["auth"]["kind"], "api-key">;
// After Phase 2: no lifecycle or classifier fields exist on any provider
type _4 = Assert<"lifecycle" extends keyof (typeof PROVIDERS)["github"], false>;
type _5 = Assert<"classifier" extends keyof (typeof PROVIDERS)["github"], false>;
// After Phase 10: WebhookProvider accepts ApiKeyDef; ApiProvider can have inbound webhooks
type _6 = Assert<ApiKeyDef<unknown> extends WebhookProvider["auth"], true>;
type _7 = Assert<InboundWebhookDef<unknown> | undefined, ApiProvider["inbound"]>;
```

## Performance Considerations

- `deriveVerifySignature` is called per webhook — negligible overhead (one function creation, cached via closure)
- Auto-derived discriminated unions use `Object.values()` once at module load
- `_AssertDisplayComplete` is `declare const` — zero runtime overhead, type-checked only
- `healthCheck.check()` (when implemented) makes one API call per connection per poll interval — negligible
- `ProviderShape<K>`, `AuthDefFor<K>`, `AccountInfoFor<K>`, `EventKeysFor<K>` are pure types — erased before bundling, zero runtime overhead
- `eventKeySchema` enum is built once at module load from `Object.entries(PROVIDERS)` — O(n) where n = provider count (5), negligible
- `getProvider<K>` narrow overload has zero runtime overhead — same body as the wide overload, TypeScript dispatches the overload at compile time only

## Migration Notes

- No breaking changes for external consumers — `index.ts` barrel re-exports all existing symbols
- `display.ts` exports are preserved via shim — existing imports continue to work
- `gateway.ts` split is non-breaking — `index.ts` re-exports from all three files
- `ProviderConfigMap` removal is internal — it was never exported
- GitHub's `auth.kind` changes from `"oauth"` to `"app-token"` — any code that checks `auth.kind === "oauth"` for GitHub specifically needs updating (gateway callback handlers)
- The `webhookSecretEnvKey` map deletion in relay is a runtime change — verify all 4 providers' secrets resolve correctly via `extractSecret(providerConfig)`
- `LifecycleDef`, `LifecycleReason`, and `EventClassifier` are deleted — any external code importing these types must be updated (no known external consumers exist)
- `classifier` and `lifecycle` fields are removed from `WebhookProvider` — any code accessing `provider.classifier` or `provider.lifecycle` will get a compile error (confirmed: no runtime consumer exists)
- `WebhookProvider.auth` widened from `OAuthDef | AppTokenDef` to `AuthDef` — existing providers still infer narrow types via factory generics; no consumer impact
- `ApiProvider` gains optional `inbound?: InboundWebhookDef` — non-breaking addition; `hasInboundWebhooks` guard updated to match
- `SignatureScheme` union gains Ed25519 — `deriveVerifySignature` return type changes from sync to `boolean | Promise<boolean>`; relay verification must `await` the result
- `@noble/ed25519` added as dependency to `console-providers`

## References

- Synthesis: `thoughts/shared/research/2026-03-18-provider-architecture-synthesis.md`
- Future innovations: `thoughts/shared/research/2026-03-18-provider-architecture-future.md`
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

### 2026-03-18 — Phase 3 type hardening: union-first SignatureScheme

- **Trigger**: Pre-implementation review found the original Phase 3 design had `signatureSchemeSchema = hmacSchemeSchema` (a flat alias, not a union). This means `SignatureScheme = HmacScheme` — adding ed25519 would require changing the `SignatureScheme` type itself, cascading to `WebhookDef` and every consumer. The `encoding` field was dead code (`computeHmac`/`timingSafeEqual` are hex-only; `deriveVerifySignature` never read it). `sha512` was in the enum but `computeHmac` doesn't support it, creating an untested runtime path. The `hmac()` factory widened literal types. The ternary algorithm mapping had a silent non-exhaustive fallthrough.
- **Changes**:
  - **Phase 3** — `signatureSchemeSchema` is now `z.discriminatedUnion("kind", [hmacSchemeSchema])`. Union structure established with one member today. New variants (ed25519, base64, sha512) extend the union array only — `WebhookDef`, `ProviderDefinition`, and relay are untouched in all extension scenarios.
  - **Phase 3** — `hmacSchemeSchema` is unexported (internal variant). Public interface is `SignatureScheme` (the union) and `HmacScheme` (the inferred variant type).
  - **Phase 3** — Removed `encoding` from `hmacSchemeSchema`. Added back when `computeHmac` supports base64, with `.default("hex")` for back-compat. No `WebhookDef` change needed.
  - **Phase 3** — Removed `sha512` from algorithm enum. Added back when `computeHmac` supports it. No `WebhookDef` change needed.
  - **Phase 3** — `hmac()` factory is now generic (`<const T extends Omit<HmacScheme, "kind">>`): literal algorithm types preserved on `PROVIDERS.*` (e.g., `"sha256"` not `"sha256" | "sha1"`).
  - **Phase 3** — `deriveVerifySignature` uses an exhaustive `switch (scheme.kind)` dispatcher + `_deriveHmacVerify` variant function. TypeScript errors when a new `kind` is added without a case.
  - **Phase 3** — `HMAC_ALGO_MAP` uses `as const satisfies Record<HmacScheme["algorithm"], ...>`: TypeScript errors when a new algorithm is added to the enum without updating the map.
  - **Phase 3** — Relay mismatch diagnostic logging hardcoding scoped to Phase 7 (fits naturally with secret resolution rewrite).
  - **Phase 3** — Added `VerifyFn` type alias for the verification function signature (DRY).
  - **Phase 7** — Gains one additional item: update relay mismatch diagnostic logging to use `signatureScheme.signatureHeader`.
- **Impact on remaining work**: Phase 3 implementation is more code (union setup, split functions) but the structure is future-proof. Phases 4-9 unchanged. Phase 7 gains one small logging update.

### 2026-03-18 — Phase 10: Complete provider type coverage

- **Trigger**: Gap analysis between plan and research (`thoughts/shared/research/2026-03-17-provider-architecture-redesign.md`) identified 3 schema-level gaps after Phase 9: (A) `WebhookProvider.auth` still restricted to `OAuthDef | AppTokenDef` — Stripe untypeable, (B) `ApiProvider` cannot receive webhooks — Clerk/Datadog untypeable, (C) Ed25519 not in `SignatureScheme` — Clerk/Svix/Discord signatures unverifiable. Decision: complete all research schemas now (interfaces only, no provider implementations) to prove the architecture and make future providers fill-in-the-blank.
- **Changes**:
  - **Phase 10** (new) — Three schema extensions: (1) Widen `WebhookProvider.auth` to `AuthDef`, (2) Add `InboundWebhookDef` + optional `inbound` on `ApiProvider` + update `hasInboundWebhooks` guard, (3) Add Ed25519 to `SignatureScheme` union with `@noble/ed25519` dependency.
  - **"What We're NOT Doing"** — `WebhookCapability on ApiProvider` and `Ed25519 signature scheme` moved to in-scope (Phase 10). Both struck through with references.
  - **Desired End State** — Updated to reflect full provider type coverage.
  - **Implementation Approach** — Phase 10 depends on Phases 3 and 9.
  - **Testing Strategy** — Added Ed25519 unit tests and Phase 10 type-level assertions.
  - **Migration Notes** — Added `VerifyFn` async widening, `@noble/ed25519` dependency.
  - **PollingDef remains deferred** — requires runtime infrastructure (polling worker service) and no concrete polling-only provider exists yet.
- **Impact on remaining work**: Plan grows from 9 to 10 phases. Phase 10 is schema-only with zero runtime risk. After Phase 10, every provider in the research taxonomy has a typed home.

### 2026-03-18 — Phase 4 & 8: Display-first architecture + server-only boundary

- **Trigger**: Pre-implementation review of Phase 4 identified a fundamental client/server boundary problem. `define.ts` imports `@t3-oss/env-core` and calls `process.env` via `buildEnvGetter()`. Any module that imports `PROVIDERS` at runtime (including Phase 8's planned `PROVIDER_CLIENT_REGISTRY`) pulls the entire server dependency graph into client bundles. There is no runtime-safe way to extract icon data from provider definitions into a client-safe file without codegen or conditional exports — both over-engineered.
- **Changes**:
  - **Phase 4** — Completely rewritten: "Display Consolidation + Icon Field" → "Display-First Architecture + Compile-Time Completeness Enforcement". Direction inverted: providers **spread from** `display.ts` (not the other way around). `display.ts` stays a zero-import leaf node. Added `icon: IconDef` and `comingSoon?: true` to `BaseProviderFields`. Added `_AssertDisplayComplete` type assertion in `registry.ts`: adding a live display entry without a `PROVIDERS` implementation is a **compile-time error** naming the missing slug (using `declare const`, zero runtime overhead). Added `ProviderDisplayEntry` as a public export from `display.ts`. Deleted `display-sync.test.ts` — type system enforces what the runtime test did, bidirectionally.
  - **Phase 8** — Completely rewritten: "ClientShape + PROVIDER_CLIENT_REGISTRY" → "Server-Only Boundary Enforcement". Dropped `ClientShape`, `extractClientShape`, `client-registry.ts`, `PROVIDER_CLIENT_REGISTRY` — superseded by display-first architecture. Added `import "server-only"` to `index.ts` (hard build-time error for client barrel imports). Updated 4 client components importing runtime values from barrel to use `@repo/app-providers/display` subpath.
  - **Current State Analysis** — Added: duplication between `display.ts` and provider definitions; 19 client consumers identified; client/server split is convention-only (no `server-only` enforcement).
  - **Desired End State** — Updated: "display.ts is canonical source" replaces "display metadata lives on providers"; `server-only` enforcement replaces `ClientShape`.
  - **"What We're NOT Doing"** — Added: `ClientShape`/`extractClientShape`/`PROVIDER_CLIENT_REGISTRY` (superseded); moving display data to `index.ts` barrel.
  - **Testing Strategy** — Removed `extractClientShape` test; kept all other tests unchanged.
  - **Performance** — Updated: removed `PROVIDER_CLIENT_REGISTRY` note, added `_AssertDisplayComplete` note.
- **Impact on remaining work**: Phase 4 and 8 are both complete rewrites but same phase count (10). All other phases unchanged. Phase 5's `ProviderConfigMap` removal must preserve the `_AssertDisplayComplete` declarations added in Phase 4.

### 2026-03-18 — Phase 4 complete rewrite: Zod-First Registry Unification (absorbs Phases 5 + 8)

- **Trigger**: User requirement to strictly upgrade to Zod 4 across the package, limit standalone TypeScript `type`/`interface` declarations in favour of `z.infer<>`, enforce discriminated unions with proper propagation, and evaluate Zod 4's `z.registry()` WeakMap pattern for innovative type-system solutions.
- **Changes**:
  - **Phase 4** — Completely rewritten a second time: "Display-First Architecture + Compile-Time Completeness Enforcement" → **"Zod-First Registry Unification"**. Absorbs original Phases 5 and 8 (same file scope, no external dependencies beyond Phase 3). New scope:
    1. `display.ts` — Add `providerDisplayEntrySchema` (Zod object); `ProviderDisplayEntry = z.infer<typeof providerDisplayEntrySchema>` replaces the TypeScript interface; add `providerSlugSchema = z.enum(Object.keys(PROVIDER_DISPLAY))` with `.meta()` as THE canonical slug/name/sourceType source.
    2. `define.ts` — Add `providerKindSchema = z.enum(["webhook", "api"])` and `authKindSchema = z.enum(["oauth", "api-key", "app-token"])`; factory `kind` literals now use `satisfies z.infer<typeof providerKindSchema>` to anchor to the enum.
    3. `registry.ts` — Remove `ProviderConfigMap`; auto-derive `providerAccountInfoSchema` and `providerConfigSchema` as `z.discriminatedUnion` from `PROVIDERS`; `sourceTypeSchema` becomes a re-export of `providerSlugSchema`; `_AssertDisplayComplete` type assertion enforces compile-time completeness; `ProviderName` and `SourceType` become `z.infer<typeof providerSlugSchema>` aliases.
    4. `index.ts` — Add `import "server-only"` hard boundary; migrate 4 client barrel importers to `./display` subpath.
    5. Delete `__tests__/display-sync.test.ts` — type system replaces runtime enforcement.
  - **`z.registry()` evaluated and rejected** — Zod 4's `z.registry()` uses a WeakMap and is designed for dynamic/unknown schema sets (OpenAPI generators, form builders). For a statically known 5-provider registry, it adds indirection without value and cannot solve the client/server split (WeakMap lookup still requires server-side schema objects). Rejected for core pattern.
  - **`.meta()` adopted** — `z.schema.meta({ id, description, ... })` is accepted as sugar for `z.globalRegistry` metadata; applied to `providerSlugSchema` and `signatureSchemeSchema` for OpenAPI documentation flow.
  - **`z.function()` evaluated and rejected** — Loses `TConfig` generic → `(...args: unknown[]) => unknown`. Behavioral interfaces (`OAuthDef`, `AppTokenDef`, `ApiKeyDef`, `HealthCheckDef`, `BackfillDef`, `ResourcePickerDef`) must remain TypeScript interfaces — they contain generic function members that Zod cannot express without losing type information.
  - **Phase 5 absorbed** — `ProviderConfigMap` removal and auto-derived unions are now Phase 4 scope.
  - **Phase 8 absorbed** — `server-only` boundary and client component migration are now Phase 4 scope.
  - **Plan count** — Phases 5 and 8 now carry `> ABSORBED into Phase 4` notices; total scope is unchanged (10 phases), but Phase 4 is larger and Phases 5 + 8 are no-ops.
- **Impact on remaining work**: Phase 4 is now the largest phase (5 sub-tasks, two file-creation operations). Phases 5 and 8 require no implementation. All other phases (1-3, 6-7, 9-10) are unchanged. Phase 6 (gateway split), Phase 7 (relay secret threading), and Phase 9 (ManagedProvider) have no dependency on the registry changes in Phase 4.

### 2026-03-18 — Phase 4 Step 8: Phantom Provider Graph

- **Trigger**: Identified a remaining architectural gap — consumers (relay, gateway, backfill) still operate with wide `ProviderDefinition` types despite the Zod-first refactor. `getProvider("github")` returns `ProviderDefinition`, not `AppTokenDef`-auth-holding narrowed type. `EventKey` is a string union with no runtime validation counterpart. No mechanism for consumer packages to reference per-provider types without importing the runtime `PROVIDERS` object.
- **Changes**:
  - **Phase 4, Step 8** (new) — "Phantom Provider Graph": four interlocking additions that close the type loop:
    - **8A — Brand `providerSlugSchema`**: `.brand<"ProviderSlug">()` makes `ProviderSlug` nominal. Raw strings cannot be passed where `ProviderSlug` is required.
    - **8B — Mapped `EventKey` + `eventKeySchema`**: Compile-time `EventKey` mapped type derived from `PROVIDERS[K]["events"]` keys — auto-updates when providers change. Runtime `eventKeySchema = z.enum([...])` derived from the same source — structurally identical by construction, so compile-time and runtime representations cannot diverge.
    - **8C — `ProviderShape<K>` + utility types**: `AuthDefFor<K>`, `AccountInfoFor<K>`, `EventKeysFor<K>` — pure type utilities. Consumer packages use `import type { AuthDefFor }` (erased before bundling) to get `AuthDefFor<"github"> → AppTokenDef` with zero runtime coupling to `PROVIDERS`.
    - **8D — Narrow `getProvider<K>`**: Overload that returns `ProviderShape<K>` for literal slug arguments. `getProvider("github").auth.kind` resolves to `"app-token"` at the type level — no casts, no assertions.
    - **8E — Updated exports**: `eventKeySchema`, `ProviderShape`, `AuthDefFor`, `AccountInfoFor`, `EventKeysFor` exported from `index.ts`.
  - **Performance section** — Added 3 new notes: `ProviderShape`/utility types are pure-type (zero runtime), `eventKeySchema` built once at module load, narrow `getProvider` overload has zero runtime overhead.
- **Core invariant established**: compile-time `EventKey` type and runtime `eventKeySchema` are derived from the same source. They cannot diverge. `EventKey` is no longer hand-maintained.
- **Impact on remaining work**: Phase 4 grows by one step (now 8 sub-steps). Phase 4 implementation order updated: `registry.ts` changes now include Step 8 before `index.ts`. All other phases unchanged. Consumers (relay, gateway, backfill) gain narrow types without any changes to their own code — they just add `import type { AuthDefFor }` where currently they type-cast.

### 2026-03-18 — Phases 1–10 complete: file reference update

- **Trigger**: All 10 phases implemented. During implementation the `define.ts` monolith was split into a proper directory structure (`provider/`, `factory/`, `runtime/`, `contracts/`, `client/`). Phase 10 file references in the plan still pointed to the old monolith paths.
- **Changes**:
  - **Phase 10, Step 1** — File updated from `define.ts` → `provider/shape.ts` (WebhookProvider), `factory/webhook.ts` (factory generic)
  - **Phase 10, Step 2** — Files updated from `define.ts` → `provider/webhook.ts` (InboundWebhookDef), `provider/shape.ts` (ApiProvider.inbound)
  - **Phase 10, Step 3** — File updated from `define.ts` → `provider/shape.ts`
  - **Phase 10, Step 4** — Files updated from `define.ts` → `provider/webhook.ts` (schema + factory), `runtime/verify/ed25519.ts` (implementation), `runtime/verify/index.ts` (dispatch)
  - **Phase 10, Step 5** — File updated from `define.ts` → `factory/api.ts`
- **Impact**: Plan is now accurate to the implemented file structure. All phases complete.

### 2026-03-18 — Phase 9: Defer runtime wiring, type architecture only

- **Trigger**: Decision to defer `ManagedProvider` runtime wiring until a concrete managed provider (HubSpot, Stripe) is ready to be added. The type architecture should be in place so that adding the first managed provider is a focused runtime-only task.
- **Changes**:
  - **Phase 9** — Rewritten from "ManagedProvider Tier" (full runtime wiring) to "ManagedProvider Type Architecture" (types only). Removed: DB migration (`webhookSetupState` column), relay `providerGuard` → `hasInboundWebhooks` update, gateway callback managed provider setup flow. Added: `providerKindSchema` update to include `"managed"`, `satisfies` constraint on factory `kind` injection. Phase is now purely `define.ts` + `index.ts` changes — zero consumer changes.
  - **"What We're NOT Doing"** — Added: ManagedProvider runtime wiring (DB migration, relay guard, gateway callback) deferred until first concrete managed provider.
  - **Implementation Approach** — Updated: Phase 7 no longer depends on Phase 9's `hasInboundWebhooks`; relay guard migration deferred.
- **Impact on remaining work**: Phase 9 is smaller and has zero runtime risk. Phase 10 is unchanged (depends on Phase 9 for `hasInboundWebhooks` type guard, which is still defined in Phase 9). When the first managed provider is added, a follow-up plan covers: DB migration, relay guard update, gateway callback flow.
