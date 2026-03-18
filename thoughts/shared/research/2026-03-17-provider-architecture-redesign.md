---
date: 2026-03-17T00:00:00+00:00
researcher: claude
git_commit: 1581d9e1aed547ec49dd02499c9978a7ea8206b4
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "Provider Architecture Redesign — Layered Type System for Long-Term Extensibility"
tags: [research, architecture, providers, console-providers, define, gateway, registry, webhooks, oauth, api-key, backfill, polling, startup-taxonomy]
status: complete
last_updated: 2026-03-18
---

# Research: Provider Architecture Redesign

**Date**: 2026-03-17
**Git Commit**: `1581d9e1aed547ec49dd02499c9978a7ea8206b4`
**Branch**: `refactor/define-ts-provider-redesign`

---

## Research Question

Evaluate the current provider type architecture in `packages/console-providers/src/define.ts`, `display.ts`, and `gateway.ts`. Design a layered architectural diagram of all schema/interface relationships. Propose the most extensible, type-safe architecture for long-term growth — supporting new provider patterns (Clerk/PostHog programmatic setup, Apollo API-only, and the full startup integration journey). Evaluate iteratively until finalized.

---

## Summary

The current system has a strong 2-tier discriminated union (`WebhookProvider | ApiProvider`) with well-designed auth abstractions. However, it carries 7 structural assumptions that will break as the provider catalog grows beyond the current 5. The most critical: `WebhookProvider.auth` is hardcoded to `OAuthDef` (breaking Stripe/Clerk), there is no `WebhookRegistrationDef` (programmatic register/deregister), `ApiProvider` cannot receive webhooks (breaking Clerk/Datadog), and `display.ts` is entirely decoupled from the registry with no type enforcement.

The proposed redesign keeps the 2-tier union but extends it with 6 targeted innovations that add ~0 breaking changes while enabling every provider type a startup will encounter through Series C.

---

## Current Architecture

### Layer Map (as-is)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 6: Display (display.ts)                                              │
│  PROVIDER_DISPLAY — static, hand-maintained, NO type link to ProviderName  │
│  ProviderSlug = keyof PROVIDER_DISPLAY  (derives from itself, not registry) │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑ NO TYPE ENFORCEMENT ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 5: Registry (registry.ts)                                            │
│  PROVIDERS = { apollo, github, vercel, linear, sentry }                    │
│  sourceTypeSchema  = z.enum(Object.keys(PROVIDERS))   ← derived            │
│  EVENT_REGISTRY    = IIFE over PROVIDERS               ← derived            │
│  providerAccountInfoSchema  = z.discriminatedUnion([...])  ← MANUAL        │
│  providerConfigSchema       = z.discriminatedUnion([...])  ← MANUAL        │
│  PROVIDER_ENVS()   = Object.values(PROVIDERS).map(p => p.env)              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 4: Provider Tiers (define.ts lines 478-725)                         │
│                                                                             │
│  WebhookProvider                     ApiProvider                           │
│  ─────────────                       ─────────────                         │
│  kind: "webhook"                     kind: "api"                           │
│  auth: OAuthDef  ← HARDCODED         auth: OAuthDef | ApiKeyDef            │
│  webhook: WebhookDef                 backfill?: BackfillDef                │
│  classifier: EventClassifier         (no webhook field)                    │
│  lifecycle: LifecycleDef             (no classifier)                       │
│  backfill: BackfillDef               (no lifecycle)                        │
│                                                                             │
│  Both extend BaseProviderFields (api, categories, events, resourcePicker,  │
│  configSchema, accountInfoSchema, envSchema, createConfig, edgeRules, etc.)│
│                                                                             │
│  ProviderDefinition = WebhookProvider | ApiProvider   (kind discriminant)  │
│                                                                             │
│  Factories: defineWebhookProvider(), defineApiProvider()                   │
│    ↳ inject kind, lazy env getter via closure, Object.freeze()             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 3: Capabilities (define.ts)                                         │
│                                                                             │
│  WebhookDef<TConfig>          EventClassifier           LifecycleDef       │
│  ─────────────────            ───────────────           ────────────        │
│  extractDeliveryId            classify(type, action)    events: Record<    │
│  extractEventType               → "lifecycle"             string,           │
│  extractEventType               | "data"                  (action, payload) │
│  extractResourceId              | "unknown"               → { reason,       │
│  extractSecret                                              resourceIds? }> │
│  headersSchema: z.ZodObject                                                 │
│  parsePayload                                                               │
│  verifySignature   ← scheme not declared; HMAC-SHA1 vs SHA-256 implicit    │
│                                                                             │
│  BackfillDef                  ResourcePickerDef         ProviderApi        │
│  ──────────                   ─────────────────         ───────────         │
│  defaultEntityTypes           enrichInstallation        baseUrl             │
│  entityTypes: Record<         installationMode          buildAuthHeader?    │
│    string,                      "multi"|"merged"        defaultHeaders?     │
│    BackfillEntityHandler>       |"single"               endpoints: Record<  │
│  supportedEntityTypes         listResources               string,           │
│                               resourceLabel               ApiEndpoint>      │
│                                                          parseRateLimit     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 2: Event & Schema Primitives (define.ts)                            │
│                                                                             │
│  CategoryDef          SimpleEventDef<S>      ActionEventDef<S, TActions>  │
│  ─────────────        ─────────────────      ──────────────────────────── │
│  description          kind: "simple"         kind: "with-actions"         │
│  label                label, weight          label, weight                 │
│  type: "observation"  schema: S              schema: S                     │
│         |"sync+obs"   transform(payload,     transform(payload,            │
│                         ctx, eventType)        ctx, eventType)             │
│                       → PostTransformEvent   actions: Record<              │
│                                                string, ActionDef>          │
│  ActionDef                                                                  │
│  ─────────                                                                  │
│  label, weight                                                              │
│                                                                             │
│  EventDefinition = SimpleEventDef | ActionEventDef   (kind discriminant)  │
│  Factories: simpleEvent(), actionEvent()                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Auth Primitives (define.ts lines 98-170)                         │
│                                                                             │
│  OAuthDef<TConfig, TAccountInfo>     ApiKeyDef<TConfig, TAccountInfo>     │
│  ─────────────────────────────       ──────────────────────────────────── │
│  kind: "oauth"                       kind: "api-key"                       │
│  buildAuthUrl(config, state)         buildAuthHeader(apiKey)               │
│  exchangeCode(config, code, uri)     getActiveToken(config, extId, tok)    │
│  getActiveToken(config, extId, tok)  processSetup(config, { apiKey })      │
│  processCallback(config, query)      usesStoredToken: true (always)        │
│  refreshToken(config, token)         validateKey?(config, apiKey)          │
│  revokeToken(config, token)          revokeToken?(config, apiKey)          │
│  usesStoredToken: boolean            refreshToken?: never                  │
│                                                                             │
│  AuthDef = OAuthDef | ApiKeyDef    (kind discriminant)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 0: Cross-Service Wire Contracts (gateway.ts)                        │
│                                                                             │
│  webhookEnvelopeSchema         backfillTriggerPayload                      │
│  webhookReceiptPayloadSchema   backfillEstimatePayload                     │
│  serviceAuthWebhookBodySchema  backfillRunRecord                           │
│  gatewayConnectionSchema       proxyExecuteRequestSchema                   │
│  gatewayTokenResultSchema      proxyExecuteResponseSchema                  │
│                                                                             │
│  All wire schemas use sourceTypeSchema (from registry) for .provider field │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Current Provider Matrix

| Provider | Kind | Auth | Sig Scheme | HMAC | `optional` | Backfill | `installationMode` |
|---|---|---|---|---|---|---|---|
| GitHub | webhook | OAuth (GitHub App JWT) | SHA-256 | `X-Hub-Signature-256` | No | ✓ | `multi` |
| Linear | webhook | OAuth | SHA-256 | `linear-signature` | Yes | ✓ | `merged` |
| Sentry | webhook | OAuth | SHA-256 | `sentry-hook-signature` | Yes | ✓ | `single` |
| Vercel | webhook | OAuth | **SHA-1** | `x-vercel-signature` | Yes | ✓ | `multi` |
| Apollo | api | **API key** | — | — | Yes | ✗ | `single` |

### Concrete Architectural Flows

**Webhook inbound (relay middleware chain):**
```
POST /webhooks/:provider
  → providerGuard:          getProvider() + isWebhookProvider()
  → serviceAuthDetect:      X-API-Key check
  → webhookHeaderGuard:     providerDef.webhook.headersSchema.safeParse(headers)
  → rawBodyCapture:         c.req.text()
  → signatureVerify:        providerDef.webhook.verifySignature(rawBody, headers, secret)
  → payloadParseAndExtract: providerDef.webhook.parsePayload() + extract*(...)
  → handler:                workflowClient.trigger(WebhookReceiptPayload)
```

**OAuth connection setup (gateway):**
```
GET /:provider/authorize
  → Redis store: gw:oauth:state:{state}  (TTL 600s)
  → auth.buildAuthUrl(config, state) → redirect to provider

GET /:provider/callback
  → Redis atomic read+delete: gw:oauth:state:{state}
  → auth.processCallback(config, query) → CallbackResult
  → gatewayInstallations upsert
  → writeTokenRecord() → gatewayTokens (AES-GCM encrypted)
```

**Backfill flow:**
```
notifyBackfill (console tRPC)
  → POST /trigger (backfill service)
  → inngest.send("apps-backfill/run.requested")
  → backfillOrchestrator: plan resource × entityType work units
  → step.invoke backfillEntityWorker per work unit
  → entityHandler.buildRequest(ctx, cursor) → gw.executeApi()
  → entityHandler.processResponse() → relay.dispatchWebhook()
```

---

## Identified Architectural Gaps

### Gap 1 — Auth ↔ Webhook coupling (critical)
`WebhookProvider.auth` is typed as `OAuthDef<TConfig, TAccountInfo>` (`define.ts:503`). This hardcodes OAuth as the only auth strategy for webhook-receiving providers. Breaks:
- **Stripe** — webhook-receiving provider that uses API key auth (restricted API key)
- **Clerk** — API key (backend secret key) + Svix-backed webhook delivery
- **Datadog** — API key + passive webhook alerts

**Root cause**: The original assumption was "if you push events to us via webhook, you established the connection via OAuth." True for GitHub/Linear/Sentry/Vercel but false in general.

### Gap 2 — Missing `WebhookRegistrationDef` (important)
All current webhook providers register their webhook endpoints programmatically during `processCallback`, but this is implicit and ad-hoc. There is no typed contract for:
- Calling the provider's API to register your webhook URL on connect
- Calling the provider's API to deregister on disconnect (teardown lifecycle)
- Storing the returned `webhookId` and per-connection `signingSecret`

For GitHub, registration happens automatically via the GitHub App installation mechanism. For HubSpot, Stripe, Vercel, Zendesk, PagerDuty, Sentry service hooks — explicit HTTP calls are required. Without `WebhookRegistrationDef`, the connectionLifecycleWorkflow cannot know which providers need deregistration.

### Gap 3 — `ApiProvider` cannot receive webhooks (important)
`ApiProvider` (`define.ts:522`) has no `webhook`, `classifier`, or `lifecycle` fields. This prevents:
- **Clerk** — API key auth + Svix/Ed25519 webhook reception
- **Datadog** — API key + webhook for monitor alerts
- Any future provider that uses API key auth but also supports inbound webhook push

### Gap 4 — `SignatureScheme` not a first-class type (important)
`WebhookDef.verifySignature` is a black-box function per provider. The relay's `webhookSecretEnvKey` map (`relay/src/middleware/webhook.ts:65-82`) is manually maintained. The scheme — HMAC-SHA256 vs HMAC-SHA1 (Vercel) vs Ed25519 (Clerk/Discord/Svix) — is implicit inside each provider's `verifySignature` implementation.

**Consequence**: The relay middleware cannot route to different crypto verification paths generically. Adding an Ed25519 provider today requires custom middleware changes, not just a new provider definition.

### Gap 5 — Missing `PollingDef` (moderate)
`ApiProvider` has `BackfillDef` for historical import but no `PollingDef` for continuous scheduled pull. PostHog, Amplitude, Mixpanel, Grafana, and New Relic are polling-only (no webhook) — they need a scheduling primitive. Without it, "polling" means "backfill triggered periodically," which lacks semantics for cursor state, polling frequency, and incremental vs. full sync.

### Gap 6 — `display.ts` drift risk (moderate)
`PROVIDER_DISPLAY` in `display.ts` is a hand-maintained static map with no type-level constraint that every registered `ProviderName` has a display entry. Adding a provider to `PROVIDERS` does not produce a TypeScript error if its display entry is missing. `ProviderSlug = keyof typeof PROVIDER_DISPLAY` derives from the display map — not from the canonical registry — creating a risk of divergence.

### Gap 7 — Manual discriminated union tuples (low, but scaling pain)
`providerAccountInfoSchema` and `providerConfigSchema` in `registry.ts:136-155` are manually-listed `z.discriminatedUnion([...])` tuples. The registry comment explicitly warns: "Adding a provider = add entry to ProviderConfigMap + PROVIDERS + this tuple." This is a 3-place update requirement for every new provider. At 5 providers it's manageable; at 20+ it's error-prone.

---

## Proposed New Architecture

### Design Principles

1. **Composition over tiers** — provider capabilities (webhook reception, polling, backfill) are opt-in, not tier-defining
2. **Auth is orthogonal to event delivery** — any auth strategy can pair with any event delivery pattern
3. **Zero breaking changes** — the 2-tier union survives; we extend, not replace
4. **Declarative over imperative** — prefer data (SignatureScheme type) over functions where possible to enable generic middleware routing
5. **Single source of truth** — display metadata co-located with provider definition; discriminated union schemas derived from `PROVIDERS`

---

### Innovation 1 — Decouple Auth from Event Reception

**Change**: `WebhookProvider.auth` widens from `OAuthDef` to `AuthDef` (the full discriminated union).

```typescript
// BEFORE (define.ts:503)
export interface WebhookProvider<TConfig, TAccountInfo, ...> {
  readonly auth: OAuthDef<TConfig, TAccountInfo>;  // ← OAuth only
  ...
}

// AFTER
export interface WebhookProvider<TConfig, TAccountInfo, ...> {
  readonly auth: AuthDef<TConfig, TAccountInfo>;  // ← OAuth or API key
  ...
}
```

**Enables**: Stripe (API key + webhook), Clerk (secret key + Svix webhook), Datadog webhook alerts. No changes to gateway service — `auth.kind` discriminant already drives branching.

---

### Innovation 2 — Add `WebhookRegistrationDef` capability

New optional field on both `WebhookProvider` and `ApiProvider` for providers where we programmatically manage webhook endpoint lifecycle.

```typescript
/** Programmatic webhook endpoint lifecycle management.
 *  Providers that require an API call to register/deregister your endpoint
 *  (GitHub repo hooks, Stripe, HubSpot, Vercel, Zendesk, PagerDuty, etc.).
 *  The gateway's connectionLifecycleWorkflow calls register() on connect
 *  and deregister() on teardown.
 */
export interface WebhookRegistrationDef<TConfig> {
  /** Register your webhook URL with the provider. Called during connection setup.
   *  Returns a provider-assigned webhookId and the signing secret to store. */
  readonly register: (
    config: TConfig,
    webhookUrl: string,
    installationId: string,
    events?: readonly string[]
  ) => Promise<{ webhookId: string; signingSecret: string }>;

  /** Deregister the webhook endpoint. Called during connection teardown. */
  readonly deregister: (
    config: TConfig,
    webhookId: string
  ) => Promise<void>;

  /** Update subscribed event types (e.g., when user changes sync events). Optional. */
  readonly updateEvents?: (
    config: TConfig,
    webhookId: string,
    events: readonly string[]
  ) => Promise<void>;
}
```

**Where it lives**: Optional field on both `WebhookProvider` and `ApiProvider` with webhook capability:
```typescript
readonly webhookRegistration?: WebhookRegistrationDef<TConfig>;
```

**Gateway impact**: `connectionLifecycleWorkflow` and the callback handler check for `providerDef.webhookRegistration` and invoke `register()`/`deregister()` as appropriate. The `webhookId` and `signingSecret` are stored in `gatewayInstallations` (new columns or JSONB extension).

---

### Innovation 3 — Webhook capability on `ApiProvider`

Add an optional `webhook` bundle to `ApiProvider` for providers that use API key auth but also deliver inbound webhooks.

```typescript
/** Webhook reception bundle — all fields needed to receive + route inbound events.
 *  Optional on ApiProvider; required on WebhookProvider. */
export interface WebhookCapability<TConfig> {
  readonly classifier: EventClassifier;
  readonly def: WebhookDef<TConfig>;
  readonly lifecycle?: LifecycleDef;  // optional: not all webhook providers have teardown events
  readonly registration?: WebhookRegistrationDef<TConfig>;
}

// BEFORE (define.ts:522-547)
export interface ApiProvider<...> {
  readonly auth: AuthDef<TConfig, TAccountInfo>;
  readonly backfill?: BackfillDef;
  readonly kind: "api";
}

// AFTER
export interface ApiProvider<...> {
  readonly auth: AuthDef<TConfig, TAccountInfo>;
  readonly backfill?: BackfillDef;
  readonly kind: "api";
  readonly polling?: PollingDef<TConfig>;          // Innovation 5
  readonly webhook?: WebhookCapability<TConfig>;   // NEW: e.g. Clerk, Datadog
}
```

**Relay impact**: The relay's `providerGuard` middleware changes from `isWebhookProvider(p)` to checking for the webhook capability:
```typescript
// New guard (handles both tiers)
function hasWebhookCapability(p: ProviderDefinition): p is ProviderDefinition & { webhook: WebhookCapability<unknown> } {
  if (isWebhookProvider(p)) return true;
  if (isApiProvider(p) && p.webhook) return true;
  return false;
}
```

**Note on `WebhookProvider` refactor**: To avoid duplication, `WebhookProvider` can be internally restructured to use `WebhookCapability` as well, making the shape consistent:
```typescript
export interface WebhookProvider<...> {
  readonly auth: AuthDef<TConfig, TAccountInfo>;  // Innovation 1
  readonly backfill: BackfillDef;                 // required on webhook providers
  readonly kind: "webhook";
  // Inlined from WebhookCapability — kept flat for backward compat:
  readonly classifier: EventClassifier;
  readonly lifecycle: LifecycleDef;
  readonly webhook: WebhookDef<TConfig>;
  readonly webhookRegistration?: WebhookRegistrationDef<TConfig>;
}
```

---

### Innovation 4 — `SignatureScheme` as declarative first-class type

Add a `signatureScheme` field to `WebhookDef` (and `WebhookCapability.def`) that declaratively describes the crypto scheme. This allows relay middleware to route to the correct verification path generically, and allows future providers to declare their scheme without writing custom `verifySignature` implementations.

```typescript
export type SignatureScheme =
  | {
      readonly kind: "hmac";
      readonly algorithm: "sha256" | "sha1" | "sha512";
      readonly encoding: "hex" | "base64";
      /** Prefix to strip before comparing (e.g. "sha256=" for GitHub) */
      readonly prefix?: string;
      /** Anti-replay: reject if |now - timestamp_ms| > budgetMs. Include
       *  timestamp in signed payload when this is set. */
      readonly antiReplay?: {
        readonly timestampHeader: string;
        readonly budgetMs: number;
        /** How timestamp is embedded in the signed payload string, e.g. "v0:{ts}:{body}" */
        readonly signedPayloadTemplate?: string;
      };
    }
  | {
      readonly kind: "ed25519";
      /** Header carrying the base64 public key (if dynamic per-installation).
       *  If absent, use a static public key from config. */
      readonly publicKeyHeader?: string;
    }
  | {
      readonly kind: "rsa-sha256";
      readonly publicKeyHeader?: string;
    };

// WebhookDef gains:
export interface WebhookDef<TConfig> {
  // ... existing fields ...
  /** Declarative signature scheme — used by relay middleware for generic routing.
   *  The verifySignature function MUST be consistent with this declaration. */
  readonly signatureScheme: SignatureScheme;
}
```

**Current providers' schemes**:
| Provider | Scheme |
|---|---|
| GitHub | `{ kind: "hmac", algorithm: "sha256", encoding: "hex", prefix: "sha256=" }` |
| Linear | `{ kind: "hmac", algorithm: "sha256", encoding: "hex" }` |
| Sentry | `{ kind: "hmac", algorithm: "sha256", encoding: "hex" }` |
| Vercel | `{ kind: "hmac", algorithm: "sha1", encoding: "hex" }` |
| Clerk/Svix | `{ kind: "ed25519" }` |
| Stripe | `{ kind: "hmac", algorithm: "sha256", encoding: "hex", antiReplay: { timestampHeader: "stripe-timestamp", budgetMs: 300_000, signedPayloadTemplate: "{ts}.{body}" } }` |

---

### Innovation 5 — `PollingDef` for scheduled pull providers

Add a `PollingDef` capability to `ApiProvider` for providers where continuous scheduled polling is the primary event delivery mechanism.

```typescript
export interface PollingResult {
  readonly events: BackfillWebhookEvent[];  // reuse BackfillWebhookEvent shape
  readonly nextCursor: unknown | null;
  readonly rawCount: number;
}

/** Scheduled pull capability — for providers with no webhook delivery
 *  (PostHog, Amplitude, Grafana, New Relic, Mixpanel, Salesforce CDC, etc.) */
export interface PollingDef<TConfig> {
  /** Cron expression for polling schedule. Default cadence suggestion.
   *  Platform may override per-installation based on tier. */
  readonly schedule: string;  // e.g. "*/15 * * * *" (every 15 min)
  readonly supportedEntityTypes: readonly string[];
  readonly defaultEntityTypes: readonly string[];
  /** Poll a single entity type for new events since cursor.
   *  Cursor is persisted between runs — null on first poll. */
  pollEntity(
    config: TConfig,
    entityType: string,
    cursor: unknown | null,
    since: Date
  ): Promise<PollingResult>;
}
```

**Relationship to `BackfillDef`**: `PollingDef` and `BackfillDef` are conceptually similar (both paginate the provider's API for event data) but differ in lifecycle:
- `BackfillDef` = triggered manually, one-time historical import, gateway-proxied
- `PollingDef` = scheduled automatically, continuous incremental pull, may run differently

In practice, for most providers the `pollEntity` implementation will call the same `BackfillEntityHandler.buildRequest` + `processResponse` logic. A shared utility (`createPollingFromBackfill(backfillDef)`) can derive `PollingDef` from `BackfillDef` for providers that support both.

---

### Innovation 6 — Merge display metadata into provider definition

Move `icon: IconDef` and `comingSoon?: true` into `BaseProviderFields`. Derive `PROVIDER_DISPLAY` from `PROVIDERS` directly. This makes the provider definition the single source of truth for everything needed to render the integration in the UI.

```typescript
// BEFORE: display.ts (separate hand-maintained map)
export const PROVIDER_DISPLAY = {
  apollo: { name: "apollo", displayName: "Apollo", description: "...", comingSoon: true, icon: {...} },
  github: { name: "github", displayName: "GitHub", description: "...", icon: {...} },
  ...
} as const satisfies Record<string, ProviderDisplayEntry>;

// AFTER: define.ts — BaseProviderFields gains:
export interface BaseProviderFields<...> {
  ...
  readonly displayName: string;   // already exists
  readonly description: string;   // already exists
  readonly icon: IconDef;         // NEW: moved from display.ts
  readonly comingSoon?: true;     // NEW: moved from display.ts
}

// display.ts becomes a thin derived file:
import { PROVIDERS } from "./registry";
export const PROVIDER_DISPLAY = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [
    key,
    {
      name: key,
      displayName: p.displayName,
      description: p.description,
      icon: p.icon,
      comingSoon: p.comingSoon,
    }
  ])
) as Record<ProviderName, ProviderDisplayEntry>;

// ProviderSlug is now derived from ProviderName (registry):
export type ProviderSlug = ProviderName;
```

**Benefit**: TypeScript error if a new provider is added to `PROVIDERS` without an `icon`. No drift. `display.ts` still exists as a thin client-safe re-export layer (important: keeps the bundle separation for client components).

---

### Innovation 7 — Derive discriminated union schemas from `PROVIDERS`

Eliminate the manual tuple maintenance requirement:

```typescript
// BEFORE (registry.ts:136-155): manually listed
export const providerAccountInfoSchema = z.discriminatedUnion("sourceType", [
  github.accountInfoSchema,
  linear.accountInfoSchema,
  // ... must be updated manually
]);

// AFTER: auto-derived (TypeScript conditional types + mapped types)
type AccountInfoSchemas = {
  [K in ProviderName]: (typeof PROVIDERS)[K]["accountInfoSchema"]
}[ProviderName];

export const providerAccountInfoSchema = z.discriminatedUnion(
  "sourceType",
  Object.values(PROVIDERS).map(p => p.accountInfoSchema) as [
    AccountInfoSchemas,
    ...AccountInfoSchemas[]
  ]
);
```

**Constraint**: Requires every provider's `accountInfoSchema` to be a `z.ZodObject` with a `sourceType` discriminant field. This is already true for current providers — it just needs to be enforced at the type level in `BaseProviderFields`.

---

### Final Architecture (proposed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 6: Display (display.ts) — thin derived layer, client-safe           │
│  PROVIDER_DISPLAY = derived from PROVIDERS  ← NO MORE MANUAL MAINTENANCE   │
│  ProviderSlug     = ProviderName            ← same type, single source     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑ derived ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 5: Registry (registry.ts) — unchanged structure, derived schemas    │
│  PROVIDERS = { apollo, github, vercel, linear, sentry, ... }               │
│  sourceTypeSchema         = derived from Object.keys(PROVIDERS)            │
│  EVENT_REGISTRY           = derived (unchanged)                             │
│  providerAccountInfoSchema = AUTO-DERIVED from PROVIDERS (Innovation 7)   │
│  providerConfigSchema      = AUTO-DERIVED from PROVIDERS (Innovation 7)   │
│  PROVIDER_ENVS()           = unchanged                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 4: Provider Tiers (define.ts) — extended, backward-compatible       │
│                                                                             │
│  WebhookProvider                          ApiProvider                      │
│  ──────────────                           ─────────────                    │
│  kind: "webhook"                          kind: "api"                      │
│  auth: AuthDef  ← Innovation 1            auth: AuthDef                    │
│  webhook: WebhookDef                      backfill?: BackfillDef           │
│  webhookRegistration?: WHRegDef  ←Inno2  webhook?: WebhookCapability ←In3 │
│  classifier: EventClassifier              polling?: PollingDef   ← Inno 5  │
│  lifecycle: LifecycleDef                                                    │
│  backfill: BackfillDef                                                      │
│                                                                             │
│  Both gain: icon: IconDef, comingSoon?: true  ← Innovation 6              │
│                                                                             │
│  ProviderDefinition = WebhookProvider | ApiProvider   (kind discriminant)  │
│                                                                             │
│  Type guards:                                                               │
│  isWebhookProvider(p)     — unchanged                                      │
│  isApiProvider(p)         — unchanged                                      │
│  hasWebhookCapability(p)  — NEW: true if webhook or api with webhook       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 3: Capabilities (define.ts) — extended                              │
│                                                                             │
│  WebhookCapability<TConfig>   WebhookRegistrationDef<TConfig>              │
│  ──────────────────────────   ──────────────────────────────────           │
│  classifier                   register(config, url, installId, events?)    │
│  def: WebhookDef              deregister(config, webhookId)                │
│  lifecycle?: LifecycleDef     updateEvents?(config, id, events)            │
│  registration?: WHRegDef                                                    │
│                                                                             │
│  WebhookDef<TConfig> (extended)   PollingDef<TConfig> (NEW)               │
│  ──────────────────────────────   ──────────────────────────────           │
│  signatureScheme: SignatureScheme ← Inno 4   schedule: string              │
│  extractDeliveryId                           supportedEntityTypes          │
│  extractEventType                            defaultEntityTypes            │
│  extractResourceId                           pollEntity(config, type,      │
│  extractSecret                                 cursor, since)              │
│  headersSchema                                                              │
│  parsePayload                                                               │
│  verifySignature                                                            │
│                                                                             │
│  BackfillDef   ResourcePickerDef   ProviderApi   EventClassifier           │
│  (unchanged)   (unchanged)         (unchanged)   (unchanged)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 2: Event & Schema Primitives (unchanged)                            │
│  CategoryDef, ActionDef, SimpleEventDef, ActionEventDef, EventDefinition  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Auth Primitives (extended)                                       │
│  OAuthDef, ApiKeyDef (unchanged)                                           │
│  ServiceAccountDef (future: GCP/AWS/Okta WIF)                             │
│  OAuthClientCredentialsDef (future: M2M flows)                            │
│  AuthDef = union of all auth strategies                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 0: Crypto Primitives (NEW — can be a separate primitives file)      │
│  SignatureScheme: hmac(sha256|sha1|sha512) | ed25519 | rsa-sha256          │
│  AntiReplayConfig: { timestampHeader, budgetMs, signedPayloadTemplate? }  │
└─────────────────────────────────────────────────────────────────────────────┘

                           Wire Contracts (unchanged)
┌─────────────────────────────────────────────────────────────────────────────┐
│  gateway.ts — cross-service Zod schemas                                    │
│  webhookEnvelopeSchema, webhookReceiptPayloadSchema, serviceAuthWebhook,   │
│  backfillTriggerPayload, proxyExecuteRequest/Response, backfillRunRecord   │
│  All use sourceTypeSchema from registry                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Provider Placement in New Architecture

> **Updated 2026-03-18**: Expanded from 17 to 30 providers based on validated webhook registration research. Key reclassifications: Clerk → WebhookProvider (app-level Svix config, not manual paste), Vercel → ManagedProvider (`POST /v1/webhooks` programmatic registration). Added `Tier` column mapping to implemented architecture (`WebhookProvider | ManagedProvider | InboundWebhookDef | ApiProvider`).

### Tier Definitions

| Tier | Who registers the webhook? | Teardown? |
|---|---|---|
| **WebhookProvider** | Set once in developer console (app-level). Auto for all customers who install. | App-level (revoke install) |
| **ManagedProvider** | Our code calls `POST /webhooks` (or equivalent) per customer at connection time. | Our code calls `DELETE` on disconnect |
| **InboundWebhookDef** (on ApiProvider) | Customer manually pastes URL in their dashboard. No programmatic API. | Customer's responsibility |
| **ApiProvider** (no webhooks) | N/A — polling only | N/A |

### Full Provider Matrix (30 providers)

```
Provider                  Tier              Auth          Signature             WHReg       Polling?  Backfill?
────────────────────────  ────────────────  ────────────  ────────────────────  ──────────  ────────  ────────
GitHub                    WebhookProvider   app-token     HMAC-256 (prefix)     App-level   No        Yes
Linear                    WebhookProvider   oauth         HMAC-256              App-level   No        Yes
Sentry                    WebhookProvider   oauth         HMAC-256              App-level   No        Yes
HubSpot (upcoming)        WebhookProvider   oauth         HMAC-256 (V3)        App-level   No        Yes
Slack (upcoming)          WebhookProvider   oauth         HMAC-256 (v0=)       App-level   No        No
Discord (future)          WebhookProvider   oauth         Ed25519               App-level   No        No
Clerk (upcoming)          WebhookProvider   api-key       Ed25519/Svix          App-level   No        No
Rippling (future)         WebhookProvider   oauth         None (static bearer)  App-level   No        No

Vercel                    ManagedProvider   oauth         HMAC-SHA1             POST API    No        Yes
GitLab (upcoming)         ManagedProvider   oauth         HMAC-256              POST API    No        Yes
Bitbucket (upcoming)      ManagedProvider   oauth         HMAC-256              POST API    No        Yes
Stripe (upcoming)         ManagedProvider   api-key       HMAC-256 (t=,v1=)    POST API    No        No
Jira (upcoming)           ManagedProvider   oauth         None/JWT              POST API    No        Yes
PagerDuty (upcoming)      ManagedProvider   api-key       HMAC-256 (multi-sig) POST API    No        Yes
CircleCI (future)         ManagedProvider   api-key       HMAC-256              POST API    No        No
Asana (future)            ManagedProvider   oauth         HMAC-256 (handshake) POST API    No        No
Shortcut (future)         ManagedProvider   api-key       HMAC-256              POST API    No        No
Monday.com (future)       ManagedProvider   oauth         JWT                   GraphQL     No        No
BambooHR (future)         ManagedProvider   api-key       HMAC-256 (+ ts)      POST API    No        No
AWS SNS (future)          ManagedProvider   IAM           RSA-SHA256 (cert)    Subscribe   No        No

Datadog (upcoming)        InboundWebhook    api-key       None (static hdr)     Manual UI   Yes       No
Auth0/Okta (future)       InboundWebhook    oauth(M2M)    None (static bearer)  Manual UI   Yes       No
Salesforce (future)       InboundWebhook    oauth(JWT)    None                  Manual UI   Poll/CDC  Yes
New Relic (future)        InboundWebhook    api-key       None (static hdr)     Manual UI   Yes       No
Grafana Cloud (future)    InboundWebhook    api-key       HMAC-256 (opt-in)    Manual UI   Yes       No
Cloudflare (future)       InboundWebhook    api-key       None (static hdr)     Manual UI   No        No
PostHog (upcoming)        InboundWebhook    api-key       None                  Manual UI   Yes       No
Amplitude (future)        InboundWebhook    api-key       None                  Manual UI   Yes       No

Apollo                    ApiProvider       api-key       None                  —           No        No
Mixpanel (future)         ApiProvider       api-key       None                  —           Yes       No
GitHub Actions            ApiProvider       token         None                  —           No        No
```

### Key Findings from Validation

1. **Clerk is WebhookProvider, not InboundWebhookDef** — Clerk configures a webhook URL once in the Clerk Dashboard per-application (app-level, Svix-backed). All customer events auto-route to that URL. This is identical to GitHub/Linear/Slack. The difference: API key auth + Ed25519 signing.

2. **Vercel is ManagedProvider, not WebhookProvider** — Vercel uses `POST /v1/webhooks` for programmatic registration during Integration install. Webhooks are per-account, not app-level auto-provisioned.

3. **Most monitoring/analytics providers have NO payload signing** — Datadog, New Relic, PostHog, Amplitude, Auth0 rely on static secret headers or nothing. InboundWebhookDef providers need IP allowlisting or URL-embedded secrets as secondary verification.

4. **ManagedProvider is the largest tier** — 11 of 30 providers require programmatic registration. This validates Phase 9's `ManagedProvider` + `WebhookSetupDef` design.

5. **Stripe uses anti-replay** — `t={timestamp},v1={HMAC}` format with timestamp validation. The `SignatureScheme` may need an `antiReplay` extension in the future.

---

## Startup Integration Taxonomy

### Stage 1 — Pre-Seed / Seed (0-15 Engineers)

**Core question**: Are we shipping? How fast? Where is work stuck?

| Priority | Integration | Delivery Pattern | Auth Model | Complexity | Key Events |
|---|---|---|---|---|---|
| 1 | **GitHub** | Programmatic webhook (App) | GitHub App JWT | High | PR, push, deployment_status, workflow_run |
| 2 | **Linear** | Programmatic webhook + GraphQL | OAuth 2.0 | Low-Med | Issue, Comment, Project, Cycle |
| 2 | **Jira Cloud** | REST API polling | OAuth 2.0 (Atlassian) | High | Issues, sprints, status changes |
| 3 | **Slack** | Events API (webhook) | OAuth 2.0 bot | Med | channel messages (for delivery channel, not surveillance) |
| 4 | **Sentry** | Webhook + REST backfill | API token | Low-Med | issue, error_alert, metric_alert |
| 5 | **GitHub Actions** | Via GitHub App (no extra integration) | (included) | Low | workflow_run, check_run |

**Architecture placement (validated)**:
- GitHub, Linear, Sentry, Slack → `WebhookProvider` (app-level webhook config, auto per install)
- Jira → `ManagedProvider` (`POST /rest/api/3/webhook` per customer, 30-day expiry renewal)

---

### Stage 2 — Series A (15-60 Engineers)

**Core question**: What is our MTTR? What % of engineering is on customer asks?

| Integration | Delivery Pattern | Auth Model | Complexity | Key Value |
|---|---|---|---|---|
| **PagerDuty** | Webhook + REST backfill | API key / OAuth | Med | MTTR, incident-to-deploy correlation (Change Failure Rate) |
| **HR/HRIS** (via Merge.dev) | REST polling (unified layer) | OAuth (Merge.dev) | Low-Med | Headcount normalization, PTO context |
| **HubSpot** | REST API polling | OAuth 2.0 / private token | Med | Customer-requested work %, deal-to-epic linking |
| **Datadog** | REST polling + webhook alerts | API key | Low-Med | Service reliability vs. deploy velocity |
| **CircleCI / Buildkite** | Webhook + REST | API token | Med | Build health, pipeline bottlenecks |
| **Confluence / Notion** | REST polling | OAuth (Atlassian) / API key | Low | Documentation health signal |

**Architecture placement (validated)**:
- PagerDuty → `ManagedProvider` (`POST /webhook_subscriptions` V3 API, HMAC-SHA256 multi-sig)
- Datadog → `ApiProvider` with `inbound?: InboundWebhookDef` (manual UI config, no payload signing)
- HR/HRIS → `ApiProvider` with `polling?: PollingDef` (Innovation 5)
- HubSpot → `WebhookProvider` (app-level public app config, auto per OAuth install)
- CircleCI → `ManagedProvider` (`POST /v2/webhooks` per project)

---

### Stage 3 — Series B / Growth (60-200 Engineers)

**Core question**: How does engineering investment map to ARR? What is the R&D efficiency ratio?

| Integration | Delivery Pattern | Auth Model | Complexity | Key Value |
|---|---|---|---|---|
| **Salesforce** | REST SOQL polling | OAuth 2.0 (Connected App) | High | Engineering-to-ARR alignment, churn risk vs. delivery |
| **Snyk** | REST polling + webhooks | API token | Low-Med | Security debt trend vs. velocity |
| **SonarQube** | REST polling | Service account token | Med | Code quality metrics, tech debt quantification |
| **Jenkins** | REST polling + webhook plugin | Basic auth / API token | High | Legacy build health |
| **LaunchDarkly** | REST polling + webhooks | API token | Low | Feature flag adoption vs. deploy confidence |
| **Azure DevOps** | Webhook + REST | OAuth 2.0 (Microsoft) | High | For Microsoft-stack customers (large TAM) |

**Architecture placement (validated)**:
- Salesforce → `ApiProvider` with `inbound?: InboundWebhookDef` (manual Outbound Message config) + `polling: PollingDef`
- Snyk → `ApiProvider` with `inbound?: InboundWebhookDef` + `polling?: PollingDef`

---

### Stage 4 — Series C / Scale (200+ Engineers)

**Core question**: What does R&D actually cost? How does bureaucracy affect velocity?

| Integration | Delivery Pattern | Auth Model | Complexity | Key Value |
|---|---|---|---|---|
| **Okta** | Event Hooks (webhook) + Log API polling | OAuth 2.0 (client creds) | High | Authoritative headcount, user lifecycle |
| **Workday** | REST polling / RaaS (or Merge.dev) | OAuth / WS-Security | Very High | Loaded cost per team, R&D capitalization |
| **ServiceNow** | Table API polling + outbound webhooks | OAuth 2.0 (instance) | High | Change management overhead vs. deploy freq |
| **Snowflake / Databricks** | Outbound data export (not inbound) | API key (outbound) | Med | Engineering metrics as enterprise data product |
| **AI assistants** (Cursor, Copilot) | REST polling (usage stats APIs) | OAuth / API key | Low | AI ROI: productivity gain per seat-cost |

**Architecture placement (validated)**:
- Okta/Auth0 → `ApiProvider` with `inbound?: InboundWebhookDef` (manual Log Streams/Event Hooks config, no payload signing)
- Workday → `ApiProvider`, `polling: PollingDef`
- ServiceNow → `ApiProvider` with `inbound?: InboundWebhookDef` + `polling`

---

### Special Cases

#### Clerk (API key + Svix/Ed25519 webhook, app-level config)

> **Updated 2026-03-18**: Reclassified from `ApiProvider` + `WebhookCapability` to `WebhookProvider` with `ApiKeyDef` auth. Clerk configures a webhook URL once per-application in the Clerk Dashboard (Svix-backed). All customer events auto-route to that URL — identical to GitHub/Linear/Slack. No per-customer registration API. This is an app-level webhook config, not manual paste.

**Pattern**: API key auth + Ed25519/Svix webhook signing. Webhook URL set once in Clerk Dashboard per-application. Auto for all customers.

**Architecture placement**: `WebhookProvider` with `auth: ApiKeyDef` (Phase 10 widens `WebhookProvider.auth` to `AuthDef`) + `signatureScheme: ed25519(...)` (Phase 10 adds Ed25519 to `SignatureScheme` union).

**Key events**: `user.created`, `user.updated`, `user.deleted`, `session.created`, `organization.created`, `organizationMembership.created`, etc.

```typescript
// Clerk provider shape (updated — WebhookProvider, not ApiProvider)
const clerk = defineWebhookProvider({
  auth: { kind: "api-key", ... },      // API key (Backend Secret Key)
  webhook: {
    signatureScheme: ed25519({
      signatureHeader: "svix-signature",
      timestampHeader: "svix-timestamp",
      multiSignature: true,            // Svix sends space-separated base64 sigs
    }),
    headersSchema: z.object({
      "svix-id": z.string(),
      "svix-timestamp": z.string(),
      "svix-signature": z.string(),
    }),
    extractDeliveryId: (headers) => headers.get("svix-id") ?? crypto.randomUUID(),
    extractEventType: (_, payload) => (payload as { type: string }).type,
    extractResourceId: () => null,
    extractSecret: (config) => config.webhookSecret,
    parsePayload: (raw) => clerkWebhookPayloadSchema.parse(raw),
    // verifySignature omitted — derived from ed25519 signatureScheme
  },
});
```

#### PostHog (API key + polling, no webhooks to us)

**Pattern**: Personal API key. REST polling for events, persons, recordings. No inbound webhook from PostHog to us (they offer outbound destinations but no programmatic consumer API).

**Architecture placement**: `ApiProvider` with `polling: PollingDef` (Innovation 5). No webhook.

```typescript
const posthog = defineApiProvider({
  kind: "api",
  auth: { kind: "api-key", ... },  // Personal API key
  polling: {                        // Innovation 5
    schedule: "*/15 * * * *",       // Every 15 minutes
    supportedEntityTypes: ["event", "person", "session"],
    defaultEntityTypes: ["event"],
    async pollEntity(config, entityType, cursor, since) { ... },
  },
  backfill: { ... },                // Historical import (same API, different trigger)
});
```

---

## Iteration Log

The following design decisions were evaluated and discarded:

### Discarded: New `HybridProvider` tier
**Proposal**: A third tier `HybridProvider { kind: "hybrid" }` for providers that use API key auth but also receive webhooks.
**Discarded because**: Creates a third discriminant that complicates every switch statement across gateway/relay/backfill. The same capability is achieved by making `webhook` optional on `ApiProvider` (Innovation 3) with no new tier and ~0 switch statement changes.

### Discarded: Merge `classifier` and `lifecycle` into `WebhookDef`
**Proposal**: Collapse `classifier` and `lifecycle` into `WebhookDef` since they only make sense with webhook reception.
**Discarded because**: They serve different roles at different points in the pipeline. `WebhookDef` is pure transport (verify + extract). `classifier` and `lifecycle` are semantic routing. Keeping them separate maintains the relay/workflow separation of concerns.

### Discarded: Replace `BackfillDef` with `PollingDef` entirely
**Proposal**: Unify backfill and polling into a single `PollingDef` since both paginate the provider's API.
**Discarded because**: They have different triggers, lifecycles, and consumers. Backfill is one-shot triggered by connection setup, uses the gateway proxy, and runs through Inngest. Polling is continuous, may run in a different service, and needs cursor persistence. A shared utility (`createPollingFromBackfill`) can handle the overlap.

### Discarded: Full capability composition (no tiers, just mix-and-match)
**Proposal**: Remove `WebhookProvider`/`ApiProvider` tiers entirely. Every provider is a `BaseProvider` with optional capabilities.
**Discarded because**: The 2-tier union provides real value — it forces `WebhookProvider` to always have `backfill`, `classifier`, and `lifecycle`, which are contractually required for the relay + workflow pipelines. Removing the tiers would turn these required fields into optional, weakening the type guarantees for the majority case.

---

## Implementation Priority

| Innovation | Impact | Effort | Priority |
|---|---|---|---|
| 1 — Auth decoupling | High (unlocks Stripe, Clerk webhook, PagerDuty API key) | Trivial (type change only) | P0 |
| 4 — SignatureScheme type | High (enables Ed25519, anti-replay generically) | Low (add field to WebhookDef) | P0 |
| 6 — Display merge | Med (eliminates drift risk) | Low (add 2 fields to BaseProviderFields) | P1 |
| 3 — Webhook on ApiProvider | High (enables Clerk, Datadog) | Med (new optional field + relay guard change) | P1 |
| 2 — WebhookRegistrationDef | High (enables programmatic lifecycle) | Med (new interface + gateway wiring) | P1 |
| 5 — PollingDef | Med (enables PostHog, Amplitude, Grafana) | Med (new interface + polling worker) | P2 |
| 7 — Auto-derived schemas | Low (DX improvement) | Med (TypeScript conditional type work) | P3 |

---

## Code References

- `packages/console-providers/src/define.ts:484` — `WebhookProvider` interface
- `packages/console-providers/src/define.ts:503` — `auth: OAuthDef` hardcoded (Gap 1)
- `packages/console-providers/src/define.ts:522` — `ApiProvider` interface (no webhook field — Gap 3)
- `packages/console-providers/src/define.ts:99-133` — `OAuthDef`
- `packages/console-providers/src/define.ts:136-164` — `ApiKeyDef`
- `packages/console-providers/src/define.ts:79-96` — `WebhookDef` (no `signatureScheme` — Gap 4)
- `packages/console-providers/src/define.ts:428-476` — `BaseProviderFields` (no `icon` field — Gap 6)
- `packages/console-providers/src/define.ts:619-669` — `defineWebhookProvider` factory
- `packages/console-providers/src/define.ts:675-725` — `defineApiProvider` factory
- `packages/console-providers/src/registry.ts:30-40` — `PROVIDERS` map
- `packages/console-providers/src/registry.ts:50-52` — `sourceTypeSchema` (auto-derived)
- `packages/console-providers/src/registry.ts:136-155` — manual discriminated union tuples (Gap 7)
- `packages/console-providers/src/display.ts:18-68` — `PROVIDER_DISPLAY` (no type link to ProviderName — Gap 6)
- `packages/console-providers/src/gateway.ts:9` — `sourceTypeSchema` imported for wire schemas
- `apps/relay/src/middleware/webhook.ts:87-108` — `providerGuard` using `isWebhookProvider` (affected by Innovation 3)
- `apps/relay/src/middleware/webhook.ts:65-82` — `webhookSecretEnvKey` (manual map, affected by Innovation 4)
- `apps/relay/src/middleware/webhook.ts:215-262` — `signatureVerify` (implicit scheme, affected by Innovation 4)
- `apps/gateway/src/routes/connections.ts:503` — `auth: OAuthDef` narrowing used (affected by Innovation 1)

---

## External References

- [Clerk webhooks / Svix](https://clerk.com/docs/guides/development/webhooks/overview)
- [Clerk svixwebhook Backend API](https://pkg.go.dev/github.com/clerk/clerk-sdk-go/v2/svixwebhook)
- [PostHog CDP outbound destinations](https://posthog.com/docs/cdp/destinations/webhook)
- [GitHub App vs OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [Stripe webhook endpoints API](https://docs.stripe.com/api/webhook_endpoints/create)
- [HubSpot webhooks API v3](https://developers.hubspot.com/docs/api-reference/webhooks-webhooks-v3/guide)
- [Linear webhooks (auto-provisioned per OAuth app)](https://linear.app/developers/webhooks)
- [Faros AI — webhooks vs. APIs for engineering intelligence](https://faros.ai/blog/webhooks-vs-apis-data-ingestion-options-for-software-engineering-intelligence-platforms)
- [LinearB integration catalog](https://linearb.io/integrations)
- [Jellyfish integration catalog](https://jellyfish.co/integrations/)
- [Swarmia integrations + HR systems](https://www.swarmia.com/integrations/)
- [Asymmetric webhook signatures (EdDSA)](https://webhooks.fyi/security/asymmetric-key-signatures)
- [Salesforce JWT Bearer Flow](https://sfdcdevelopers.com/2026/01/13/salesforce-jwt-flow-guide/)
- [Svix API webhook management](https://docs.svix.com/tutorials/api-webhook-management)
