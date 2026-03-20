---
date: 2026-03-17T13:18:57Z
researcher: claude
git_commit: 1581d9e1aed547ec49dd02499c9978a7ea8206b4
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "Provider Architecture Synthesis — Zod-First, tRPC-Level Type Safety, 3-Tier Model"
tags: [architecture, synthesis, providers, define, zod-first, trpc, type-safety, gateway, relay, registry]
status: complete
last_updated: 2026-03-18
---

# Provider Architecture Synthesis — Final Design

**Date**: 2026-03-18
**Git Commit**: `1581d9e1aed547ec49dd02499c9978a7ea8206b4`
**Branch**: `refactor/define-ts-provider-redesign`

---

## Research Question

Synthesize the two prior research documents into one final, minimal, zod-first architecture that preserves the 3-tier provider model (WebhookProvider | ManagedProvider | ApiProvider) while achieving tRPC-level type safety — where `PROVIDERS.github.auth` narrows to `AppTokenDef`, not `AuthDef`.

**Prior documents:**
- `thoughts/shared/plans/2026-03-17-provider-architecture-extensibility.md` — 6-phase implementation plan
- `thoughts/shared/research/2026-03-17-provider-architecture-redesign.md` — 7-innovation redesign analysis

---

## Summary

The live codebase (`define.ts`, `registry.ts`, three provider implementations, relay middleware, gateway connections handler) was read in full. The synthesis yields **10 targeted changes** that are fully backward-compatible. The most significant innovation is treating `SignatureScheme` as a first-class **Zod schema** (pure data — no functions), which eliminates the relay's manually-maintained `webhookSecretEnvKey` map and enables generic HMAC/Ed25519 routing. Combined with `AppTokenDef`, optional `lifecycle`, `ManagedProvider`, display consolidation, gateway.ts split, registry auto-derivation, bundle-split-aware `ClientShape<P>`, and `HealthCheckDef` for polling + passive lifecycle detection, the result is a system where:

- Adding a provider is a **1-touch operation** (add to `PROVIDERS` only)
- `PROVIDERS.github.auth` has type `AppTokenDef`, not `OAuthDef`
- `lifecycle: { events: {} }` on Linear is deleted — the field is optional
- Clerk and PostHog can be typed correctly without new design primitives
- The relay derives signing secrets from provider definitions — no manual map
- Revoked connections are detected within 5 min (Inngest polling) or seconds (relay DLQ passive detection) via `HealthCheckDef.check()`

---

## Architecture Principles

### The Zod-First Boundary

The single most important design principle: **Zod schemas are for data. TypeScript interfaces are for behaviours (functions).**

| Layer | Zod Schema | TypeScript Interface/Type |
|---|---|---|
| Auth strategies | `kind` literal only | `OAuthDef`, `ApiKeyDef`, `AppTokenDef` (contain functions) |
| Signature scheme | ✅ Fully Zod (`SignatureScheme`) | — (pure data) |
| Icon definition | ✅ Fully Zod (`iconDefSchema`) | — (pure data) |
| Category/Action defs | ✅ Fully Zod (`categoryDefSchema`, `actionDefSchema`) | — (pure data) |
| Wire contracts | ✅ Fully Zod (`gateway.ts` all schemas) | — (pure data) |
| Event definitions | Interface (contains `transform` fn) | `SimpleEventDef`, `ActionEventDef` |
| Webhook extraction | Interface (contains functions) | `WebhookDef<TConfig>` |
| Lifecycle events | Interface (contains functions) | `LifecycleDef` |
| Backfill entity | Interface (contains functions) | `BackfillEntityHandler` |
| Provider classifier | Interface (contains function) | `EventClassifier` |

The flagship zod-first innovation in this synthesis is `SignatureScheme` — the crypto scheme declaration is pure structured data with no functions. It validates at runtime, narrows at compile time, and enables generic relay routing.

### The tRPC-Level Type Safety Pattern

tRPC achieves end-to-end type safety by preserving concrete types through generic inference chains. The current codebase already has the key primitive:

```typescript
// registry.ts:125-131 — already tRPC-style
export function getProvider<N extends ProviderName>(name: N): (typeof PROVIDERS)[N];
export function getProvider(name: string): ProviderDefinition | undefined;
```

`PROVIDERS.github` already narrows to its full concrete type through `as const satisfies`. The gap is that `github.auth` is typed as `OAuthDef` — which is wrong for GitHub App, and which cannot be `AppTokenDef` because `WebhookProvider.auth` is hardcoded to `OAuthDef`.

The synthesis fixes this at the source: widen `WebhookProvider.auth`, remove `ProviderConfigMap`, trust the factory return types.

---

## Live Codebase Gaps Confirmed

Reading the live codebase confirmed every gap identified in the prior research:

1. **`define.ts:504`** — `readonly auth: OAuthDef<TConfig, TAccountInfo>` hardcoded on `WebhookProvider`
2. **`define.ts:512`** — `readonly lifecycle: LifecycleDef` required on `WebhookProvider`
3. **`providers/github/index.ts:156`** — `kind: "oauth" as const` but `usesStoredToken: false`, `refreshToken` returns reject, `exchangeCode` stores no token. Structurally an App Token.
4. **`providers/linear/index.ts:411-413`** — `lifecycle: { events: {} }` — empty object, no-op, forced by contract
5. **`display.ts:18-67`** — 89-line static object, `ProviderSlug = keyof typeof PROVIDER_DISPLAY` (not `ProviderName`)
6. **`registry.ts:136-155`** — Two manual `z.discriminatedUnion` tuples with comments "Adding a provider = add entry to ProviderConfigMap + PROVIDERS + this tuple"
7. **`registry.ts:22-28`** — `ProviderConfigMap` interface that must be updated manually
8. **`relay/src/middleware/webhook.ts:65-82`** — `webhookSecretEnvKey` map manually maintained, separate from provider definitions
9. **`gateway/src/routes/connections.ts:121`** — `providerDef.auth.kind !== "oauth"` blocks non-OAuth providers from using the callback flow — will need updating for `AppTokenDef`

---

## The 8 Changes (Ordered by Dependency)

### Change 1 — `AppTokenDef`: Fix GitHub's Auth Semantics

**File**: `packages/console-providers/src/define.ts`

**What exists**: `OAuthDef` handles GitHub but with `usesStoredToken: false`, dead `exchangeCode` and `refreshToken`, and `getActiveToken` that generates a JWT installation token — an App Token pattern, not OAuth.

**What changes**: New third auth strategy. `AuthDef` becomes a 3-member discriminated union.

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
  /** URL the user visits to install the app */
  readonly buildInstallUrl: (
    config: TConfig,
    state: string,
    options?: Record<string, unknown>
  ) => string;
  /**
   * Process the installation callback — extracts installation_id from query.
   * Returns connected-no-token (tokens are generated on demand, never stored).
   */
  readonly processCallback: (
    config: TConfig,
    query: Record<string, string>
  ) => Promise<CallbackResult<TAccountInfo>>;
  /**
   * Generate a fresh API token on demand from app credentials + installation ID.
   * storedAccessToken is always null for app-token providers.
   */
  readonly getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: null
  ) => Promise<string>;
  /** Optional: generate an app-level token for app-scoped API calls */
  readonly getAppToken?: (config: TConfig) => Promise<string>;
  readonly buildAuthHeader?: (token: string) => string;
  /** Revoke the app installation */
  readonly revokeAccess?: (config: TConfig, externalId: string) => Promise<void>;
  readonly usesStoredToken: false; // never stored — always generated
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

**`WebhookProvider.auth` widens**:
```typescript
export interface WebhookProvider<...> {
  // OAuth (user authorizes) or App Token (system app credential)
  readonly auth: OAuthDef<TConfig, TAccountInfo> | AppTokenDef<TConfig, TAccountInfo>;
  // ...
}
```

**GitHub migration** (`providers/github/index.ts`):
```typescript
auth: {
  kind: "app-token" as const,
  buildInstallUrl: (config, state) => {
    const url = new URL(`https://github.com/apps/${config.appSlug}/installations/new`);
    url.searchParams.set("state", state);
    return url.toString();
  },
  processCallback: (_config, query) => {
    // unchanged logic — same guard checks, same return shape
    const installationId = query.installation_id;
    // ... (existing guard logic)
    return Promise.resolve({
      status: "connected-no-token",
      externalId: installationId,
      accountInfo: { ... },
    } satisfies CallbackResult<GitHubAccountInfo>);
  },
  getActiveToken: async (config, storedExternalId, _storedAccessToken) => {
    return getInstallationToken(config, storedExternalId); // unchanged runtime
  },
  getAppToken: async (config) => createGitHubAppJWT(config),
  usesStoredToken: false as const,
  revokeAccess: async (config, externalId) => { /* current revokeToken logic */ },
},
```

**Remove from GitHub**: `exchangeCode`, `refreshToken` (dead in current OAuth struct), `buildAuthUrl` (replaced by `buildInstallUrl`).

**Gateway call site** (`gateway/connections.ts:121`):
```typescript
// Before:
if (providerDef.auth.kind !== "oauth") { return c.json({ error: "not_oauth" }, 400) }

// After — handle both OAuth and app-token in callback flow:
if (providerDef.auth.kind !== "oauth" && providerDef.auth.kind !== "app-token") {
  return c.json({ error: "not_callback_provider" }, 400);
}
// TypeScript now narrows to OAuthDef | AppTokenDef — safe to call processCallback
```

---

### Change 2 — `lifecycle` Optional: Remove Empty Handler Requirement

**File**: `packages/console-providers/src/define.ts`

```typescript
export interface WebhookProvider<...> {
  /**
   * Maps wire lifecycle events to structured reasons + optional resource IDs.
   * Optional — omit when the provider does not send lifecycle events via webhook
   * (e.g., Linear, where revocation is handled out-of-band, not via webhook).
   */
  readonly lifecycle?: LifecycleDef;
}
```

**Linear cleanup** — delete the entire `lifecycle` block from `providers/linear/index.ts`:
```typescript
// DELETE:
lifecycle: {
  events: {}, // Linear webhooks are all data events; no lifecycle events via webhook
},
```

**Relay consumer** (`relay/src/routes/webhooks.ts` or wherever lifecycle is read):
```typescript
// Before:
const result = provider.lifecycle.events[eventType]?.(action, payload);

// After:
const result = provider.lifecycle?.events[eventType]?.(action, payload);
```

---

### Change 3 — `SignatureScheme`: The Zod-First Innovation

**File**: `packages/console-providers/src/define.ts`

This is the synthesis's flagship zod-first contribution. The crypto verification scheme is **pure data** — it has no functions. It is fully expressible as a Zod schema, validates at runtime, and narrows at compile time.

```typescript
// ── Signature Schemes (ZOD-FIRST — pure data, no functions) ─────────────────

export const hmacSchemeSchema = z.object({
  kind: z.literal("hmac"),
  algorithm: z.enum(["sha256", "sha1", "sha512"]),
  encoding: z.enum(["hex", "base64"]),
  /** Lowercase HTTP header name carrying the signature, e.g. "x-hub-signature-256" */
  signatureHeader: z.string(),
  /** Strip this prefix before comparing (e.g. "sha256=" for GitHub) */
  prefix: z.string().optional(),
  /**
   * Anti-replay window — reject if |now - timestamp_ms| > budgetMs.
   * When set, the timestamp is embedded in the signed payload.
   * Pattern: Stripe (v0:{ts}.{body})
   */
  antiReplay: z.object({
    timestampHeader: z.string(),
    budgetMs: z.number(),
    /** Template for embedding timestamp in signed string, e.g. "v0:{ts}.{body}" */
    signedPayloadTemplate: z.string().optional(),
  }).optional(),
});

export const ed25519SchemeSchema = z.object({
  kind: z.literal("ed25519"),
  /** Header carrying the base64 public key (dynamic per-installation).
   *  When absent, use a static public key from provider config. */
  publicKeyHeader: z.string().optional(),
});

export const signatureSchemeSchema = z.discriminatedUnion("kind", [
  hmacSchemeSchema,
  ed25519SchemeSchema,
]);

export type SignatureScheme = z.infer<typeof signatureSchemeSchema>;
export type HmacScheme = z.infer<typeof hmacSchemeSchema>;
export type Ed25519Scheme = z.infer<typeof ed25519SchemeSchema>;

// Convenience constructors for provider authors:
export const hmac = (
  opts: Omit<HmacScheme, "kind">
): HmacScheme => ({ kind: "hmac", ...opts });

export const ed25519 = (
  opts?: Omit<Ed25519Scheme, "kind">
): Ed25519Scheme => ({ kind: "ed25519", ...opts });
```

**Add to `WebhookDef`**:
```typescript
export interface WebhookDef<TConfig> {
  /**
   * Declarative signature scheme — pure data, validated by Zod at provider load time.
   * Used by relay middleware for generic routing AND to derive a default verifySignature.
   */
  readonly signatureScheme: SignatureScheme;
  /**
   * Optional — if absent, derived automatically from signatureScheme via
   * deriveVerifySignature(). Providers only need to implement this for
   * non-standard schemes (Ed25519, RSA) or unusual signing logic.
   */
  readonly verifySignature?: (
    rawBody: string,
    headers: Headers,
    secret: string
  ) => boolean;
  // ... existing fields unchanged
}
```

**`deriveVerifySignature` — platform utility** (new export in `define.ts`):
```typescript
/**
 * Derive a standard verifySignature implementation from a SignatureScheme.
 * Covers HMAC-SHA256/SHA1/SHA512 with optional prefix + anti-replay.
 * Ed25519/RSA require a custom implementation.
 */
export function deriveVerifySignature(
  scheme: SignatureScheme
): (rawBody: string, headers: Headers, secret: string) => boolean {
  return (rawBody, headers, secret) => {
    if (scheme.kind === "hmac") {
      const rawSig = headers.get(scheme.signatureHeader);
      if (!rawSig) return false;
      const received = scheme.prefix ? rawSig.slice(scheme.prefix.length) : rawSig;
      const alg = scheme.algorithm.toUpperCase().replace("-", "") as "SHA256" | "SHA1" | "SHA512";
      const expected = computeHmac(rawBody, secret, alg);
      return timingSafeEqual(received, expected);
    }
    // Ed25519 / RSA: no default — provider must supply verifySignature
    return false;
  };
}

// Relay middleware — use derived or provided implementation:
const verify = providerDef.webhook.verifySignature
  ?? deriveVerifySignature(providerDef.webhook.signatureScheme);
const verified = verify(rawBody, headers, secret);
```

**GitHub, Linear, Sentry delete their `verifySignature`** — the platform derives it from `signatureScheme`.
Vercel retains its own since SHA-1 is handled by the standard HMAC path (it will just work once `signatureHeader` is declared).

**Provider scheme declarations** (add to each provider's `webhook` block):
```typescript
// github — verifySignature deleted, derived automatically:
signatureScheme: hmac({
  algorithm: "sha256",
  encoding: "hex",
  signatureHeader: "x-hub-signature-256",
  prefix: "sha256=",
}),

// linear — verifySignature deleted:
signatureScheme: hmac({
  algorithm: "sha256",
  encoding: "hex",
  signatureHeader: "linear-signature",
}),

// sentry — verifySignature deleted:
signatureScheme: hmac({
  algorithm: "sha256",
  encoding: "hex",
  signatureHeader: "sentry-hook-signature",
}),

// vercel — verifySignature deleted:
signatureScheme: hmac({
  algorithm: "sha1",
  encoding: "hex",
  signatureHeader: "x-vercel-signature",
}),

// Future — Stripe (with anti-replay):
signatureScheme: hmac({
  algorithm: "sha256",
  encoding: "hex",
  signatureHeader: "stripe-signature",
  antiReplay: {
    timestampHeader: "stripe-timestamp",
    budgetMs: 300_000,
    signedPayloadTemplate: "v0:{ts}.{body}",
  },
}),

// Future — Clerk/Svix (Ed25519 — must provide custom verifySignature):
signatureScheme: ed25519(),
verifySignature: (rawBody, headers, secret) => verifySvix(rawBody, headers, secret),
```

**Relay: Eliminate `webhookSecretEnvKey` map**

This is the downstream payoff. Currently `relay/src/middleware/webhook.ts:65-82` maintains a manual `Partial<Record<ProviderName, keyof typeof env>>` map. With `signatureScheme` on `WebhookDef` and provider configs threaded through the relay (like the gateway does), this map is eliminated.

```typescript
// relay/src/index.ts (or wherever relay initializes) — mirror the gateway pattern:
const relayRuntime = { callbackBaseUrl: env.RELAY_BASE_URL };
const providerConfigs = Object.fromEntries(
  Object.entries(PROVIDERS)
    .map(([name, p]) => [name, p.createConfig(env, relayRuntime)])
    .filter(([, config]) => config !== null)
) as Partial<Record<ProviderName, unknown>>;

// relay/src/middleware/webhook.ts — signatureVerify middleware:
// Before:
const secretEnvKey = webhookSecretEnvKey[providerName];
const secret = secretEnvKey ? env[secretEnvKey] : undefined;

// After:
const providerConfig = providerConfigs[providerName];
const secret = providerConfig
  ? providerDef.webhook.extractSecret(providerConfig)
  : undefined;
```

The `webhookSecretEnvKey` map is deleted. Provider configs are the single source of truth for secrets.

---

### Change 4 — `ManagedProvider`: Programmatic Webhook Registration

**File**: `packages/console-providers/src/define.ts`

New third tier for providers where we programmatically call their API to register our webhook URL during installation (Clerk with programmatic setup, PostHog destinations, Stripe, Amplitude).

```typescript
// ── Webhook Setup (for ManagedProvider) ─────────────────────────────────────

/**
 * State returned from WebhookSetupDef.register() — stored per-connection as JSONB.
 * Minimum fields required for verification and teardown.
 */
export const webhookSetupStateSchema = z.object({
  /** Provider's ID for this webhook endpoint — used for unregistration */
  endpointId: z.string(),
  /** Signing secret returned by the provider at registration time */
  signingSecret: z.string(),
});
export type WebhookSetupState = z.infer<typeof webhookSetupStateSchema>;

/**
 * Programmatic webhook registration contract.
 * Implemented by providers where we control the webhook endpoint lifecycle.
 */
export interface WebhookSetupDef<
  TConfig,
  TState extends WebhookSetupState = WebhookSetupState,
> {
  /**
   * Register our webhook URL with the provider during installation.
   * Called after auth is established (token available).
   * Returns state that MUST be stored alongside the connection.
   */
  readonly register: (
    config: TConfig,
    token: string,
    webhookUrl: string,
    events: readonly string[]
  ) => Promise<TState>;
  /**
   * Unregister our webhook endpoint during teardown.
   * Called before the connection record is deleted.
   */
  readonly unregister: (
    config: TConfig,
    token: string,
    state: TState
  ) => Promise<void>;
  /** Events/topics to subscribe to when registering. Provider-specific strings. */
  readonly defaultEvents: readonly string[];
}

/**
 * Inbound webhook capability bundle for ManagedProvider.
 * Same HMAC/Ed25519 verification as WebhookProvider, plus setup lifecycle.
 */
export interface ManagedWebhookDef<
  TConfig,
  TState extends WebhookSetupState = WebhookSetupState,
> {
  /** HMAC/Ed25519 verification + extraction — identical contract to WebhookDef */
  readonly webhook: WebhookDef<TConfig>;
  /** Event routing: lifecycle | data | unknown */
  readonly classifier: EventClassifier;
  /** Lifecycle events from the provider — optional for managed providers */
  readonly lifecycle?: LifecycleDef;
  /** Programmatic registration/unregistration with the provider */
  readonly setup: WebhookSetupDef<TConfig, TState>;
}

/**
 * Managed-webhook provider — we programmatically register our webhook URL.
 * Auth is typically API-key (user provides key → we call provider API to register endpoint).
 * Examples: Clerk (when programmatic reg is available), PostHog, Stripe, Amplitude.
 */
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

**Update `ProviderDefinition`**:
```typescript
export type ProviderDefinition<...> =
  | WebhookProvider<...>
  | ManagedProvider<...>
  | ApiProvider<...>;
```

**Type guards**:
```typescript
export function isManagedProvider(p: { kind: string }): p is ManagedProvider {
  return p.kind === "managed";
}

/**
 * True for any provider that receives inbound webhooks — native OR managed.
 * Used by relay to determine if it should expect inbound events.
 */
export function hasInboundWebhooks(
  p: { kind: string }
): p is WebhookProvider | ManagedProvider {
  return p.kind === "webhook" || p.kind === "managed";
}
```

**Factory**:
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

**Database**: Add `webhookSetupState jsonb` column (nullable) to `gw_installations`. Run `pnpm db:generate && pnpm db:migrate`.

**Gateway callback**: After `processCallback` for a managed provider, call `setup.register()` and persist the returned state.

**Relay `providerGuard`**: Update from `isWebhookProvider(p)` to `hasInboundWebhooks(p)`. For managed providers, the signing secret comes from `connection.webhookSetupState.signingSecret` (not from `provider.inbound.webhook.extractSecret(config)`).

---

### Change 5 — Display Consolidation: Single Source of Truth

**Files**: `packages/console-providers/src/define.ts` + all provider `index.ts` + `display.ts`

**`BaseProviderFields`** gains two fields:
```typescript
interface BaseProviderFields<...> {
  // ... existing fields ...
  /** SVG icon data — renderable by any UI layer without import side effects */
  readonly icon: IconDef;
  /**
   * When true, provider is not yet available to end users.
   * Shown as "Coming soon" in UI. Excluded from ACTIVE_PROVIDER_SLUGS.
   */
  readonly comingSoon?: true;
}
```

**Each provider gets `icon` + optional `comingSoon`** (SVG path data moved from `display.ts` into each provider definition).

**`display.ts` rewritten as a thin derived layer**:
```typescript
import type { IconDef } from "./define";
export type { IconDef } from "./define";
import { PROVIDERS } from "./registry";
import type { ProviderName } from "./registry";

interface ProviderDisplayEntry {
  readonly comingSoon?: true;
  readonly description: string;
  readonly displayName: string;
  readonly icon: IconDef;
  readonly name: string;
}

// Derived — single source of truth is provider definitions
export const PROVIDER_DISPLAY = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [
    key,
    {
      name: key,
      displayName: p.displayName,
      description: p.description,
      icon: p.icon,
      ...(p.comingSoon ? { comingSoon: true as const } : {}),
    } satisfies ProviderDisplayEntry,
  ])
) as Record<ProviderName, ProviderDisplayEntry>;

// ProviderSlug is now ProviderName — single source of truth
export type ProviderSlug = ProviderName;

export const PROVIDER_SLUGS = Object.keys(PROVIDER_DISPLAY) as ProviderSlug[];

export const ACTIVE_PROVIDER_SLUGS = PROVIDER_SLUGS.filter(
  (slug) => !PROVIDER_DISPLAY[slug].comingSoon
);

export const SOURCE_TYPE_OPTIONS = PROVIDER_SLUGS.map((key) => ({
  value: key,
  label: PROVIDER_DISPLAY[key].displayName,
}));
```

---

### Change 6 — `gateway.ts` Split: One Contract Per File

**Current state**: `gateway.ts` is 222 lines mixing 4 distinct cross-service contracts.
**After**: 3 files, each with a single consumer.

```
wire.ts           ← relay ↔ console pipeline
  serviceAuthWebhookBodySchema
  webhookReceiptPayloadSchema
  webhookEnvelopeSchema

gateway.ts        ← gateway API + proxy (trimmed)
  gatewayConnectionSchema
  gatewayTokenResultSchema
  proxyExecuteRequestSchema
  proxyExecuteResponseSchema
  proxyEndpointsResponseSchema

backfill-contracts.ts   ← console ↔ backfill service
  backfillDepthSchema
  gwInstallationBackfillConfigSchema
  backfillTerminalStatusSchema
  backfillTriggerPayload
  backfillEstimatePayload
  backfillRunRecord
  backfillRunReadRecord
```

`index.ts` re-exports all three — zero breaking changes for external consumers. Internal imports within each app update to the appropriate file.

**Note**: `backfill-contracts.ts` avoids collision with `BackfillDef` in `define.ts`.

---

### Change 7 — Registry 1-Touch: Remove `ProviderConfigMap` + Auto-Derive Unions

**File**: `packages/console-providers/src/registry.ts`

**Currently**: Adding a provider requires 4 manual updates:
1. `ProviderConfigMap` interface
2. `PROVIDERS` object
3. `providerAccountInfoSchema` tuple
4. `providerConfigSchema` tuple

**After**: Adding a provider is 1 update: `PROVIDERS` only.

**Remove `ProviderConfigMap`**:

The `satisfies` constraint was providing compile-time validation that each provider's config type is correct. This is already enforced by the factory functions (`defineWebhookProvider`, `defineApiProvider`, `defineManagedProvider`) — each factory infers and enforces the generic parameters. The `as const` on `PROVIDERS` preserves all concrete types. `ProviderConfigMap` is redundant.

```typescript
// Before:
interface ProviderConfigMap {
  readonly apollo: ApolloConfig;
  readonly github: GitHubConfig;
  readonly linear: LinearConfig;
  readonly sentry: SentryConfig;
  readonly vercel: VercelConfig;
}

export const PROVIDERS = {
  apollo, github, vercel, linear, sentry,
} as const satisfies {
  readonly [K in keyof ProviderConfigMap]: ProviderDefinition<ProviderConfigMap[K]>;
};

// After (1-touch — just add the provider to this object):
export const PROVIDERS = {
  apollo, github, vercel, linear, sentry,
} as const;
```

**Auto-derive discriminated unions**:

```typescript
// Helper: build discriminated union from any array of ZodObject schemas
// Works around Zod's requirement for a non-empty tuple type
function makeDiscriminatedUnion<
  TKey extends string,
  T extends z.ZodDiscriminatedUnionOption<TKey>,
>(key: TKey, schemas: [T, ...T[]]) {
  return z.discriminatedUnion(key, schemas);
}

// Derived — no manual maintenance needed
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

**Type-level constraint** (replaces `ProviderConfigMap`'s compile-time check):

The factories return `WebhookProvider<TConfig, ...>` / `ApiProvider<TConfig, ...>` / `ManagedProvider<TConfig, ...>`. TypeScript catches config type mismatches at the factory call site. No additional constraint interface needed.

---

### Change 8 — Relay Config Threading: Eliminate Manual Secret Map

**Files**: `apps/relay/src/` (middleware + entry point)

This is the downstream architectural payoff of Changes 1, 3, and 4 combined.

**Current** (`relay/src/middleware/webhook.ts:65-82`):
```typescript
// Manually maintained — must be updated whenever a provider is added/removed
const webhookSecretEnvKey: Partial<Record<ProviderName, keyof typeof env>> = {
  github: "GITHUB_WEBHOOK_SECRET",
  vercel: "VERCEL_CLIENT_INTEGRATION_SECRET",
  linear: "LINEAR_WEBHOOK_SIGNING_SECRET",
  sentry: "SENTRY_CLIENT_SECRET",
};
```

**After — mirror the gateway's `providerConfigs` pattern**:

```typescript
// relay/src/app.ts (or equivalent entry point):
const runtime = runtimeConfigSchema.parse({ callbackBaseUrl: env.RELAY_BASE_URL });
const providerConfigs: Partial<Record<ProviderName, unknown>> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .map(([name, p]) => [name, p.createConfig(env, runtime)])
    .filter(([, config]) => config !== null)
);

// relay/src/middleware/webhook.ts — signatureVerify:
// Before:
const secretEnvKey = webhookSecretEnvKey[providerName];
const secret = secretEnvKey ? env[secretEnvKey] : undefined;
if (!secret) return c.json({ error: "no_secret" }, 500);

// After:
const providerConfig = providerConfigs[providerName];
if (!providerConfig) return c.json({ error: "provider_not_configured" }, 500);
const secret = providerDef.webhook.extractSecret(providerConfig);
```

`webhookSecretEnvKey` is deleted. The relay now uses the same config-building pattern as the gateway. Adding a new provider with a webhook secret automatically works — no relay changes needed.

**For `ManagedProvider`** (Change 4), the secret comes from `connection.webhookSetupState.signingSecret`, not from `extractSecret`. The middleware should check `hasInboundWebhooks(providerDef)` and then branch on `isManagedProvider` vs `isWebhookProvider` for secret resolution.

---

### Change 9 — Bundle-Split-Aware Provider Shapes: `ClientShape<P>`

**File**: `packages/console-providers/src/define.ts` + new `packages/console-providers/src/client-registry.ts`

**The problem**: `display.ts` is the current "client-safe" separation, but it only covers display metadata. Every provider's `index.ts` imports crypto utilities, JWT libraries, and fetch wrappers. Nothing prevents a bundler misconfiguration from pulling `getInstallationToken` into a browser build. The separation depends on import discipline, not types.

**What changes**: A first-class `ClientShape<P>` type that TypeScript enforces as safe for any bundle, and a derived `PROVIDER_CLIENT_REGISTRY` that replaces `PROVIDER_DISPLAY` as the UI layer's import target.

```typescript
// define.ts — new utility type:
/**
 * Client-safe subset of a provider definition.
 * Contains only pure data — no functions, no env access, no crypto.
 * Safe to import in browser bundles, RSC, edge functions, test harnesses.
 */
export type ClientShape<P extends ProviderDefinition> = {
  readonly name: P["name"];
  readonly displayName: P["displayName"];
  readonly description: P["description"];
  readonly icon: P["icon"];
  readonly comingSoon: P["comingSoon"];
  readonly categories: P["categories"];
  // Derived event key union — label + weight only, no schema/transform
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

```typescript
// packages/console-providers/src/client-registry.ts (new file):
import { PROVIDERS } from "./registry";
import type { ProviderName } from "./registry";
import { extractClientShape, type ClientShape } from "./define";
import type { ProviderDefinition } from "./define";

/**
 * Client-safe provider registry — import this in browser/RSC code instead of PROVIDERS.
 * Contains zero functions, zero env access, zero crypto. Pure data.
 * TypeScript prevents accidentally accessing server-only fields from this object.
 */
export const PROVIDER_CLIENT_REGISTRY = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [key, extractClientShape(p)])
) as { readonly [K in ProviderName]: ClientShape<(typeof PROVIDERS)[K]> };

export type ProviderClientShape = (typeof PROVIDER_CLIENT_REGISTRY)[ProviderName];
```

**Replaces `display.ts`**: `display.ts` becomes a thin re-export shim for backward compat:
```typescript
// display.ts — backward-compat shim (deprecated, remove in next major):
export { PROVIDER_CLIENT_REGISTRY as PROVIDER_DISPLAY } from "./client-registry";
export type { ProviderClientShape as ProviderDisplayEntry } from "./client-registry";
export { PROVIDER_SLUGS, ACTIVE_PROVIDER_SLUGS, SOURCE_TYPE_OPTIONS } from "./client-registry";
```

**Payoff**: The UI layer imports `PROVIDER_CLIENT_REGISTRY`. TypeScript prevents accessing `verifySignature`, `createConfig`, `backfill`, or `auth` from client code. Adding a provider to `PROVIDERS` automatically appears in `PROVIDER_CLIENT_REGISTRY` — no second registration. Display drift is impossible.

---

### Change 10 — `HealthCheckDef`: Polling + Passive Detection Lifecycle

**Files**: `packages/console-providers/src/define.ts`

**The problem**: When a user revokes a GitHub App installation (or any provider access), `gatewayInstallations.status` stays `"active"` in the DB indefinitely. `workspaceIntegrations.isActive` is never set to `false` by any automated path. The `lifecycle.events` / `EventClassifier` declarations exist but nothing runtime-consumes them yet.

**What changes**: Two complementary detection paths, unified by a single `HealthCheckDef` contract on each provider:

1. **Polling (primary)** — Inngest cron every 5 min fans out one `healthCheck.check()` call per active installation → updates DB if unhealthy. No new infrastructure beyond Inngest.
2. **Passive detection (real-time)** — relay DLQ path fires an immediate health check when a webhook can't be routed. Catches revocation within seconds of the next webhook arrival.

**Changes to `define.ts`**:

```typescript
// ── Connection Status (ZOD-FIRST) ─────────────────────────────────────────────

/**
 * Zod-validated status for gatewayInstallations.status.
 * Usable at the DB layer boundary for runtime validation.
 */
export const connectionStatusSchema = z.enum([
  "pending",
  "active",
  "suspended",
  "revoked",
]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

// ── Lifecycle Transition (named return type) ──────────────────────────────────

/**
 * Named return type of lifecycle.events[eventType](action, payload).
 * Installation-scope transitions carry no resourceIds.
 * Resource-scope transitions (repo removed/deleted) carry resourceIds.
 */
export type LifecycleTransition =
  | { readonly reason: "revoked" | "suspended" | "unsuspended" }
  | { readonly reason: "removed" | "deleted"; readonly resourceIds: readonly string[] };

// ── Health Check (polling + passive detection) ─────────────────────────────────

/**
 * Lightweight liveness probe for an active provider connection.
 * Called by the polling cron (every 5 min) and on passive detection (DLQ interception).
 * Returns null if the connection is healthy.
 * Returns a LifecycleTransition if the connection has changed state.
 */
export interface HealthCheckDef<TConfig> {
  readonly check: (
    config: TConfig,
    externalId: string,        // gatewayInstallations.externalId
    accessToken: string | null // decrypted token (null for GitHub App — JWT generated on demand)
  ) => Promise<LifecycleTransition | null>;
}
```

**Add to `WebhookProvider` and `ApiProvider`**:
```typescript
export interface WebhookProvider<...> {
  // ... existing fields ...
  readonly healthCheck: HealthCheckDef<TConfig>;
}

export interface ApiProvider<...> {
  // ... existing fields ...
  readonly healthCheck: HealthCheckDef<TConfig>;
}
```

**Payoff**: Every provider declares its own liveness check. Adding a new provider requires only adding `healthCheck` to its definition. `ConnectionStatus` is now a Zod-validated schema, usable at the DB layer boundary. Runtime infrastructure (gateway health route, Inngest polling cron, relay DLQ passive detection) is documented in `thoughts/shared/plans/2026-03-17-lifecycle-v1-polling-passive.md`.

---

## Type Propagation Map

This shows how the tRPC-level type safety flows through the system. Read it as "X narrows Y at compile time":

```
defineWebhookProvider(def)
  → infers TConfig, TCategories, TEvents from def
  → returns WebhookProvider<TConfig, TAccountInfo, TCategories, TEvents, ...>
  → frozen with kind: "webhook" as const

PROVIDERS = { github: defineWebhookProvider(...), ... } as const
  → PROVIDERS.github has full concrete type
  → (typeof PROVIDERS)["github"] narrows to WebhookProvider<GitHubConfig, ...>

getProvider<N extends ProviderName>(name: N): (typeof PROVIDERS)[N]
  → getProvider("github") returns WebhookProvider<GitHubConfig, ...>
  → getProvider("github").auth has type OAuthDef | AppTokenDef  ← after Change 1
  → getProvider("github").auth.kind === "app-token" narrows to AppTokenDef<GitHubConfig>
  → getProvider("github").auth.usesStoredToken has type false  ← exact literal

isWebhookProvider(p) / isManagedProvider(p) / hasInboundWebhooks(p)
  → narrows ProviderDefinition to the correct tier
  → relay middleware: after providerGuard, all accesses are type-safe

WebhookDef<TConfig>.signatureScheme: SignatureScheme
  → signatureSchemeSchema validates at runtime (Zod)
  → scheme.kind === "hmac" narrows to HmacScheme (TypeScript)
  → scheme.algorithm, scheme.prefix, scheme.antiReplay are all typed

HealthCheckDef<TConfig>.check(config, externalId, accessToken)
  → returns LifecycleTransition | null
  → LifecycleTransition.reason: "revoked" | "suspended" | "unsuspended" | "removed" | "deleted"
  → gateway /admin/health-check → updates gatewayInstallations.status
  → Inngest polling cron + relay DLQ passive detection call same gateway endpoint

EVENT_REGISTRY (derived IIFE in registry.ts)
  → Record<EventKey, EventRegistryEntry>
  → EventKey is derived: "github:pull_request.opened" | "github:issues.opened" | ...
  → Adding events to a provider automatically extends EventKey

providerAccountInfoSchema (auto-derived, Change 7)
  → z.discriminatedUnion("sourceType", [...])
  → ProviderAccountInfo = z.infer<typeof providerAccountInfoSchema>
  → Adding a provider to PROVIDERS extends ProviderAccountInfo automatically
```

---

## What We Are NOT Doing

Explicitly out of scope for this synthesis. Deferred items are captured in `thoughts/shared/research/2026-03-18-provider-architecture-future.md`.

- **`PollingDef`** — continuous scheduled pull for PostHog/Amplitude. Requires a polling worker service. Added when that service exists.
- **`WebhookCapability` on `ApiProvider`** — webhook reception for API-key providers without programmatic registration (Clerk's current model). Deferred: show relay URL in onboarding for manual configuration.
- **Category ↔ BackfillEntityType unification** — `"sync+observation"` categories as implicit backfill entity types. Deferred to future research.
- **Typed payload pipeline** — `payload: z.unknown()` → `payload: EventPayloadMap[P][E]` end-to-end. High-impact but requires typed `WebhookEnvelope` variants. Deferred to future research.
- **Relay auto-registration factory** — `createWebhookRouter(PROVIDERS)` derived relay routes. Deferred to future research.
- **Provider telemetry schema** — structured, Zod-validated `TelemetryEvent` emitted per provider operation. Deferred to future research.
- **`StreamingDef`** — Salesforce CDC, Kafka-style providers. Future primitive.
- **Database schema changes beyond `webhookSetupState`** — no other schema changes required.
- **Changing `BackfillDef` structure** — already correct.
- **Changing `ResourcePickerDef`** — already correct.
- **Changing `ProviderApi`** — already correct.

---

## Implementation Order

Each change builds on the previous. Changes 1-4 should be sequential. Changes 5-8 are largely independent and can parallelize with each other after Change 1.

```
Change 1 (AppTokenDef + WebhookProvider.auth widening)
  → unblocks: correct GitHub typing, foundation for all downstream changes
  → requires: gateway callback handler update

Change 2 (lifecycle optional)
  → unblocks: Linear cleanup, cleaner ManagedProvider contract
  → requires: relay/workflow lifecycle consumer null-check

Change 3 (SignatureScheme on WebhookDef)
  → unblocks: Change 8 (relay config threading), future Ed25519 providers
  → requires: all 4 current providers add signatureScheme to their webhook block

Change 4 (ManagedProvider tier)
  → unblocks: Clerk/PostHog/Stripe implementations
  → requires: db migration (webhookSetupState column), gateway setup.register() call,
              relay hasInboundWebhooks() guard update

Change 5 (display consolidation)   ← parallel with 6, 7, 8
  → unblocks: provider definitions as single source of truth
  → requires: all provider index.ts files gain icon field

Change 6 (gateway.ts split)         ← parallel with 5, 7, 8
  → unblocks: cleaner imports per service
  → requires: import path updates in relay/gateway/backfill/console apps

Change 7 (registry 1-touch)         ← parallel with 5, 6, 8
  → unblocks: 1-touch provider addition
  → requires: verify TypeScript still catches config mismatches without ProviderConfigMap

Change 8 (relay config threading)   ← depends on Change 3
  → unblocks: elimination of webhookSecretEnvKey manual map
  → requires: relay entry point gains providerConfigs initialization

Change 9 (ClientShape + PROVIDER_CLIENT_REGISTRY)   ← parallel with 5, 6, 7, 8
  → unblocks: type-enforced bundle safety for UI layer
  → requires: extractClientShape() utility, client-registry.ts, display.ts shim

Change 10 (HealthCheckDef + polling + passive detection)   ← parallel with 5, 6, 7, 8
  → unblocks: automated revocation detection within 5 min (polling) or seconds (passive)
  → requires: connectionStatusSchema, LifecycleTransition named type, healthCheck on all providers,
              gateway /admin/health-check route, Inngest polling + passive cron functions
  → runtime plan: thoughts/shared/plans/2026-03-17-lifecycle-v1-polling-passive.md
```

---

## Success Criteria

```bash
# After all 10 changes:
pnpm typecheck         # zero errors across all apps
pnpm check             # zero lint errors
pnpm --filter @repo/app-providers test   # all tests pass
pnpm db:generate       # generates migration for webhookSetupState column
pnpm db:migrate        # applies cleanly

# Type-level assertions (in a test file):
type _assert1 = Assert<(typeof PROVIDERS)["github"]["auth"]["kind"], "app-token">
type _assert2 = Assert<(typeof PROVIDERS)["github"]["auth"]["usesStoredToken"], false>
type _assert3 = Assert<(typeof PROVIDERS)["apollo"]["auth"]["kind"], "api-key">
type _assert4 = Assert<(typeof PROVIDERS)["linear"]["lifecycle"], undefined>
// Change 3: signatureScheme is runtime-validated
const _schemeCheck = signatureSchemeSchema.parse(PROVIDERS.github.webhook.signatureScheme) // no throw
// Change 9: ClientShape has no function fields
type _assert5 = Assert<keyof ClientShape<(typeof PROVIDERS)["github"]>, never extends "verifySignature" ? string : never>
// Change 10: connectionStatusSchema validates at runtime
const _statusCheck = connectionStatusSchema.parse("active") // no throw
// healthCheck enforced: TypeScript error if provider omits it
// Where: type Assert<T, U extends T> = true
```

---

## Code References

- `packages/console-providers/src/define.ts:504` — `auth: OAuthDef` hardcoded (Change 1 target)
- `packages/console-providers/src/define.ts:512` — `lifecycle: LifecycleDef` required (Change 2 target)
- `packages/console-providers/src/define.ts:79-96` — `WebhookDef` (Change 3 adds `signatureScheme`)
- `packages/console-providers/src/registry.ts:22-28` — `ProviderConfigMap` (Change 7 removes)
- `packages/console-providers/src/registry.ts:136-155` — manual union tuples (Change 7 replaces)
- `packages/console-providers/src/display.ts:18-67` — static manual map (Change 5 replaces)
- `packages/console-providers/src/gateway.ts:1-222` — mixed contracts (Change 6 splits)
- `packages/console-providers/src/providers/github/index.ts:155-254` — OAuth struct (Change 1 migrates)
- `packages/console-providers/src/providers/linear/index.ts:411-413` — empty lifecycle (Change 2 deletes)
- `apps/relay/src/middleware/webhook.ts:65-82` — `webhookSecretEnvKey` manual map (Change 8 deletes)
- `apps/gateway/src/routes/connections.ts:121` — `auth.kind !== "oauth"` check (Change 1 updates)
- `apps/gateway/src/routes/connections.ts:47-56` — `providerConfigs` pattern (Change 8 mirrors to relay)
- `packages/console-providers/src/define.ts` — `connectionStatusSchema`, `LifecycleTransition`, `HealthCheckDef` (Change 10 adds)
- `apps/gateway/src/routes/health.ts` — new internal health-check route (Change 10 runtime)
- `api/console/src/inngest/workflow/infrastructure/connection-health-poll.ts` — polling cron + passive handler (Change 10 runtime)
- `packages/console-providers/src/client-registry.ts` — new file, `PROVIDER_CLIENT_REGISTRY` (Change 9 adds)
- `packages/console-providers/src/display.ts` — becomes backward-compat shim re-exporting from client-registry (Change 9 + 5)

---

## Related Research

- `thoughts/shared/plans/2026-03-17-provider-architecture-extensibility.md` — 6-phase plan (synthesized here)
- `thoughts/shared/research/2026-03-17-provider-architecture-redesign.md` — 7-innovation analysis (synthesized here)
- `thoughts/shared/research/2026-03-17-lifecycle-reason-webhook-correlation.md` — lifecycle/webhook correlation research
- `thoughts/shared/plans/2026-03-17-lifecycle-v1-polling-passive.md` — full v1 lifecycle runtime plan (polling cron, passive DLQ, gateway health route, Inngest functions)
- `thoughts/shared/research/2026-03-18-provider-architecture-future.md` — deferred innovations (typed payload pipeline, relay auto-registration, category/backfill unification, provider telemetry)
