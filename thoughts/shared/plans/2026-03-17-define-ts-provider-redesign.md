---
date: 2026-03-17T10:00:00Z
researcher: claude
git_commit: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
branch: main
repository: lightfast
topic: "Provider definition redesign: 2-tier model, minimal define.ts, design patterns"
tags: [architecture, providers, define, console-providers, api-key, webhook, design-patterns, platform]
status: draft
last_updated: 2026-03-17
last_updated_note: "Added proxy-only ApiProvider variant, unified auth field rename, gateway connections.ts impact"
---

# Provider Definition Redesign: Minimal Two-Tier `define.ts`

## Context

Two forces are converging:

1. **`define.ts` is a God Object.** Every provider must implement all 9 capability layers
   (identity, config, events, webhook, oauth, api, backfill, resourcePicker, edgeRules)
   regardless of whether the layer applies. Adding Apollo/GTM (API-key-only, no webhooks)
   is impossible without hacking the type.

2. **The architecture research doc** (`thoughts/shared/research/2026-03-17-connection-lifecycle-architecture.md`)
   proposes merging relay + gateway into `apps/platform` and adding a `classifier.classify()`
   step that routes events to `lifecycle | data | unknown`. This classification belongs in
   the provider definition — not scattered across the relay code.

This document proposes a redesigned `packages/console-providers/src/define.ts` that:
- Introduces a **2-tier discriminated union** (`"webhook"` vs `"api"`) as the root type
- Moves `EventClassifier` into the provider definition (fixes the DLQ problem)
- Adds `LifecycleDef` to webhook providers (fixes the missing lifecycle handlers)
- Adds `AuthStrategy` for API providers (OAuth preferred, API key as fallback)
- Reduces TypeScript generics from 6 → 4 by deriving schema types from value types
- Preserves 100% backward compatibility with existing GitHub/Linear/Vercel/Sentry definitions
- Supports Apollo/GTM and any future API-key-only provider

---

## 1. Current State: The God Object Problem

```
ProviderDefinition<TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema>
│
├── Identity             (name, displayName, description)              ← all providers
├── Config               (configSchema, envSchema, createConfig, env)  ← all providers
├── Events               (categories, events, defaultSyncEvents, ...)  ← all providers
├── Webhook              (webhook: WebhookDef<TConfig>)                ← webhook only
├── OAuth                (oauth: OAuthDef<TConfig, TAccountInfo>)      ← webhook only
├── accountInfoSchema                                                   ← all providers
├── providerConfigSchema                                                ← all providers
├── API                  (api: ProviderApi)                            ← all providers
├── Backfill             (backfill: BackfillDef)                        ← all providers
├── ResourcePicker       (resourcePicker: ResourcePickerDef)           ← all providers
└── EdgeRules            (edgeRules?: EdgeRule[])                       ← all providers
```

**Problems:**
1. `webhook` and `oauth` are **required** even for API-key providers
2. The `events` map only holds **data events** — lifecycle events (installation.deleted, etc.) have no home, causing every `installation.*` GitHub webhook to DLQ
3. `EventClassifier` is not in the provider definition — the relay hard-codes classification logic per-provider
4. 6 generic type parameters make the type signature unreadable
5. `TAccountInfoSchema` and `TProviderConfigSchema` are redundant — they're just the Zod schema for `TAccountInfo` and `TProviderConfig`

---

## 2. The Two-Tier Model

```
                  ProviderDefinition
                        │
            ┌───────────┴───────────┐
            │                       │
    WebhookProvider           ApiProvider
    kind: "webhook"           kind: "api"
            │                       │
            ├── webhook             ├── auth (kind: "oauth" | "api-key")
            ├── auth (oauth)        │      └── getActiveToken, usesStoredToken
            ├── classifier  ← NEW   │          processCallback | processSetup
            ├── lifecycle   ← NEW   ├── api (endpoints, baseUrl, buildAuthHeader)
            ├── api                 ├── resourcePicker
            ├── backfill            ├── categories / events (optional)
            └── resourcePicker      ├── polling?   ← scheduled pulls (optional)
                                    └── backfill?  ← historical import (optional)
```

**`auth` replaces `oauth` on all providers** — same interface, renamed field.
The gateway's `connections.ts` calls `providerDef.auth.*` instead of `providerDef.oauth.*`.
The method signatures are identical: `getActiveToken`, `refreshToken`, `revokeToken`,
`usesStoredToken`. The only new method is `processSetup` on API-key providers (replaces
`processCallback` for non-OAuth connection flows).

### Tier 1: `WebhookProvider`
**Examples**: GitHub, Linear, Sentry, Vercel (all current providers)

- Receives events via HMAC-signed webhook POST
- Authenticates via OAuth2 (`auth.kind: "oauth"`)
- `classifier` distinguishes lifecycle vs data events (NEW — eliminates DLQ problem)
- `lifecycle` maps wire events to lifecycle reasons (NEW — fixes 8 missing scenarios)
- `backfill` for historical data import

### Tier 2: `ApiProvider`
**Examples**: Apollo (GTM), HubSpot, Salesforce, Mixpanel, Amplitude

Three sub-variants — all share `auth` + `api` + `resourcePicker` as the mandatory minimum:

| Sub-variant | `polling` | `backfill` | `events/categories` | Use case |
|-------------|-----------|------------|---------------------|----------|
| Proxy-only  | ❌ | ❌ | ❌ | On-demand API calls from tRPC |
| Polling     | ✅ | ✅ | ✅ | Scheduled data pull → Inngest pipeline |
| OAuth API   | optional | optional | optional | Full OAuth flow, no webhooks |

Auth strategy:
- `auth.kind: "api-key"` — user pastes key, stored encrypted in token vault as `accessToken`
- `auth.kind: "oauth"` — full OAuth dance, same flow as webhook providers but no webhook

---

## 3. Design Patterns Applied

### Strategy Pattern — Auth

Auth is no longer hardwired to OAuth2. It's a discriminated union:

```ts
type AuthStrategy<TConfig, TAccountInfo> =
  | OAuthStrategy<TConfig, TAccountInfo>    // existing OAuthDef, extended
  | ApiKeyStrategy<TConfig, TAccountInfo>

interface ApiKeyStrategy<TConfig, TAccountInfo> {
  readonly kind: "api-key"
  /** Build the Authorization header value from the stored key */
  readonly buildAuthHeader: (apiKey: string) => string
  /** Optional: validate key against provider API on connection setup */
  readonly validateKey?: (config: TConfig, apiKey: string) => Promise<boolean>
  /** Process connection setup (analogous to processCallback for OAuth) */
  readonly processSetup: (
    config: TConfig,
    params: { apiKey: string }
  ) => Promise<CallbackResult<TAccountInfo>>
}
```

The `OAuthStrategy` is the existing `OAuthDef` with `kind: "oauth"` added.

### Factory Pattern — Provider Constructors

Instead of one `defineProvider()` that returns the God Object:

```ts
// Tier 1: webhook + OAuth providers (GitHub, Linear, Sentry, Vercel)
export function defineWebhookProvider<TConfig, TAccountInfo, TCategories, TEvents>(
  def: Omit<WebhookProvider<TConfig, TAccountInfo, TCategories, TEvents>, "env" | "kind">
): WebhookProvider<TConfig, TAccountInfo, TCategories, TEvents>

// Tier 2: API-only providers (Apollo, HubSpot, etc.)
export function defineApiProvider<TConfig, TAccountInfo, TCategories, TEvents>(
  def: Omit<ApiProvider<TConfig, TAccountInfo, TCategories, TEvents>, "env" | "kind">
): ApiProvider<TConfig, TAccountInfo, TCategories, TEvents>
```

The `kind` discriminant is injected by the factory — provider authors never write it manually.

### Observer Pattern — Event Declarations

Events are declarative data structures that the ingest pipeline "observes" and routes:

```ts
// Provider declares what events it emits (data) and what events it handles (lifecycle)
events: { pull_request: actionEvent({ ... }), issues: actionEvent({ ... }) }
lifecycle: { events: { "installation": (action) => ... } }

// The platform classifier observes incoming events and routes them
classifier: {
  classify(eventType, action) { ... }  // → "lifecycle" | "data" | "unknown"
}
```

This is Observer without a bus — the declarations are pure data, consumed at runtime by the classifier step.

### Discriminated Union (FP) — Provider Tier

The root discriminant enables exhaustive type narrowing:

```ts
function routeEvent(provider: ProviderDefinition, eventType: string) {
  if (provider.kind === "webhook") {
    const classification = provider.classifier.classify(eventType)
    // TypeScript knows `provider.webhook` and `provider.oauth` exist here
  } else {
    // TypeScript knows `provider.auth` and `provider.polling` exist here
    // No webhook path exists for api providers
  }
}
```

### Singleton Pattern — Registry

`PROVIDERS` stays frozen at module level. No change structurally:

```ts
export const PROVIDERS = {
  github,    // WebhookProvider
  vercel,    // WebhookProvider
  linear,    // WebhookProvider
  sentry,    // WebhookProvider
  apollo,    // ApiProvider  ← new, zero changes to existing entries
} as const satisfies {
  [K in keyof ProviderConfigMap]: ProviderDefinition<ProviderConfigMap[K]>
}
```

### Decorator Pattern (FP variant) — Composable Capability Flags

Optional capabilities can be added as pure functions that return augmented definitions:

```ts
// Marks a provider as optional (env vars optional, excluded from PROVIDER_ENVS when absent)
export function withOptional<T extends BaseProviderDef>(def: T): T & { readonly optional: true }

// Adds edge rules declaratively (instead of inline in the definition)
export function withEdgeRules<T extends ProviderDefinition>(
  def: T,
  rules: EdgeRule[]
): T & { readonly edgeRules: EdgeRule[] }
```

These are optional conveniences — the inline approach still works.

---

## 4. The New `EventClassifier` (Core to Platform Architecture)

This is the most important new concept. It lives on `WebhookProvider` and directly enables the
`ingest-delivery` workflow's step 3 (`classify event`) from the architecture doc.

```ts
export interface EventClassifier {
  /**
   * Classify a raw wire event type + optional action into a routing decision.
   *
   * - "lifecycle": installation/connection management events
   *               → triggers connectionLifecycleWorkflow (platform)
   *               → NOT routed to console ingest
   * - "data":     content events (PRs, issues, deployments)
   *               → connection resolved → QStash → console ingest
   * - "unknown":  unrecognized events → DLQ
   */
  classify(eventType: string, action?: string): "lifecycle" | "data" | "unknown"
}
```

**GitHub example:**
```ts
classifier: {
  classify(eventType) {
    if (["installation", "installation_repositories", "repository"].includes(eventType)) {
      return "lifecycle"
    }
    if (["pull_request", "issues", "push", "create", "delete"].includes(eventType)) {
      return "data"
    }
    return "unknown"
  }
}
```

**Vercel example:**
```ts
classifier: {
  classify(eventType) {
    if (["integration-configuration.removed", "project.removed"].includes(eventType)) {
      return "lifecycle"
    }
    if (eventType.startsWith("deployment.")) return "data"
    return "unknown"
  }
}
```

---

## 5. The New `LifecycleDef` (Fixes the 8 Missing Scenarios)

From the scenario matrix in the architecture doc, 8 of 24 scenarios are unhandled (❌).
The root cause: there's no place in the provider definition to declare what lifecycle
events mean.

```ts
export type LifecycleReason =
  | "provider_revoked"          // installation.deleted
  | "provider_suspended"        // installation.suspend
  | "provider_unsuspended"      // installation.unsuspend
  | "provider_repo_removed"     // installation_repositories.removed
  | "provider_repo_deleted"     // repository.deleted, project.removed

export interface LifecycleDef {
  /**
   * Map from wire eventType to a function that returns the lifecycle reason.
   * Returns null if the specific action does not trigger a lifecycle transition.
   * resourceIds is populated for partial teardowns (specific repos/projects).
   */
  readonly events: Record<
    string,
    (
      action: string | undefined,
      payload: unknown
    ) => { reason: LifecycleReason; resourceIds?: string[] } | null
  >
}
```

**GitHub example:**
```ts
lifecycle: {
  events: {
    "installation": (action) => {
      if (action === "deleted")   return { reason: "provider_revoked" }
      if (action === "suspend")   return { reason: "provider_suspended" }
      if (action === "unsuspend") return { reason: "provider_unsuspended" }
      return null
    },
    "installation_repositories": (action, payload) => {
      if (action !== "removed") return null
      const p = payload as { repositories_removed?: Array<{ id: number }> }
      const ids = (p.repositories_removed ?? []).map((r) => String(r.id))
      return { reason: "provider_repo_removed", resourceIds: ids }
    },
    "repository": (action) => {
      if (action === "deleted") return { reason: "provider_repo_deleted" }
      return null
    },
  }
}
```

The `connectionLifecycleWorkflow` becomes provider-agnostic: it reads `provider.lifecycle.events`
to determine reason and resourceIds, then applies the step matrix from the architecture doc.

---

## 6. Generic Simplification: 6 → 4 Type Parameters

**Before:**
```ts
ProviderDefinition<
  TConfig,
  TAccountInfo,
  TCategories,
  TEvents,
  TAccountInfoSchema extends z.ZodObject,   // redundant
  TProviderConfigSchema extends z.ZodObject  // redundant
>
```

`TAccountInfoSchema` and `TProviderConfigSchema` are just `z.ZodType<TAccountInfo>` and
`z.ZodType<ProviderConfig>`. They were passed explicitly to preserve literal type inference for
`providerAccountInfoSchema`'s discriminated union, but this can be achieved via `satisfies`.

**After:**
```ts
WebhookProvider<TConfig, TAccountInfo, TCategories, TEvents>
ApiProvider<TConfig, TAccountInfo, TCategories, TEvents>
```

Schema types are inferred from field assignments:
```ts
// Before: explicit schema generic
accountInfoSchema: githubAccountInfoSchema,
// TypeScript knows TAccountInfoSchema = typeof githubAccountInfoSchema

// After: no generic, satisfies check in registry
// PROVIDERS.github.accountInfoSchema is typed as z.ZodType<GitHubAccountInfo>
```

---

## 7. Proposed New `define.ts` Structure

```ts
// ── Unified Auth Definition (Strategy pattern) ────────────────────────────────

/** OAuth2 auth — existing OAuthDef plus `kind` discriminant */
interface OAuthDef<TConfig, TAccountInfo> {
  readonly kind: "oauth"
  readonly buildAuthUrl: (config: TConfig, state: string, options?: Record<string, unknown>) => string
  readonly exchangeCode: (config: TConfig, code: string, redirectUri: string) => Promise<OAuthTokens>
  readonly processCallback: (config: TConfig, query: Record<string, string>) => Promise<CallbackResult<TAccountInfo>>
  readonly refreshToken: (config: TConfig, refreshToken: string) => Promise<OAuthTokens>
  readonly revokeToken: (config: TConfig, accessToken: string) => Promise<void>
  readonly getActiveToken: (config: TConfig, storedExternalId: string, storedAccessToken: string | null) => Promise<string>
  readonly usesStoredToken: boolean
}

/** API-key auth — same token vault, different setup flow */
interface ApiKeyDef<TConfig, TAccountInfo> {
  readonly kind: "api-key"
  /** Build the Authorization header value from the stored key (for ProviderApi.buildAuthHeader) */
  readonly buildAuthHeader: (apiKey: string) => string
  /** Process connection setup: receive key from UI, validate, return CallbackResult to store */
  readonly processSetup: (config: TConfig, params: { apiKey: string }) => Promise<CallbackResult<TAccountInfo>>
  /** Get the active credential — for API-key providers, returns storedAccessToken (the key itself) */
  readonly getActiveToken: (config: TConfig, storedExternalId: string, storedAccessToken: string | null) => Promise<string>
  readonly usesStoredToken: true  // API key is always stored
  readonly refreshToken?: never   // API keys don't refresh
  readonly revokeToken?: (config: TConfig, apiKey: string) => Promise<void>
}

type AuthDef<TConfig, TAccountInfo> = OAuthDef<TConfig, TAccountInfo> | ApiKeyDef<TConfig, TAccountInfo>

// ── Core (shared by all providers) ───────────────────────────────────────────

interface BaseProvider<TConfig, TAccountInfo, TCategories, TEvents> {
  // Identity
  readonly name: string
  readonly displayName: string
  readonly description: string
  readonly optional?: true

  // Config
  readonly configSchema: z.ZodType<TConfig>
  readonly createConfig: (env: Record<string, string>, runtime: RuntimeConfig) => TConfig | null
  readonly envSchema: Record<string, z.ZodType>

  // Account info + provider config
  readonly accountInfoSchema: z.ZodType<TAccountInfo>
  readonly providerConfigSchema: z.ZodObject

  // Events (data events — lifecycle events live in `lifecycle` on WebhookProvider)
  readonly categories: TCategories
  readonly events: TEvents
  readonly defaultSyncEvents: readonly string[]
  readonly buildProviderConfig: (params: { defaultSyncEvents: readonly string[] }) => unknown
  readonly resolveCategory: (eventType: string) => string
  readonly getBaseEventType: (sourceType: string) => string
  readonly deriveObservationType: (sourceType: string) => string

  // API capability (required — all providers expose callable endpoints)
  readonly api: ProviderApi

  // Resource picker (UI for linking resources)
  readonly resourcePicker: ResourcePickerDef

  // Edge rules (optional)
  readonly edgeRules?: EdgeRule[]
}

// ── Tier 1: Webhook + OAuth ───────────────────────────────────────────────────

interface WebhookProvider<TConfig, TAccountInfo, TCategories, TEvents>
  extends BaseProvider<TConfig, TAccountInfo, TCategories, TEvents> {
  readonly kind: "webhook"               // injected by defineWebhookProvider()

  readonly webhook: WebhookDef<TConfig>  // HMAC verify + event extraction
  readonly auth: OAuthDef<TConfig, TAccountInfo>  // renamed from `oauth`
  readonly classifier: EventClassifier   // NEW: lifecycle|data|unknown routing
  readonly lifecycle: LifecycleDef       // NEW: wire events → lifecycle reason+resourceIds
  readonly backfill: BackfillDef         // historical import
}

// ── Tier 2: API-Only ──────────────────────────────────────────────────────────

interface ApiProvider<TConfig, TAccountInfo, TCategories, TEvents>
  extends BaseProvider<TConfig, TAccountInfo, TCategories, TEvents> {
  readonly kind: "api"                    // injected by defineApiProvider()

  readonly auth: AuthDef<TConfig, TAccountInfo>  // OAuth or API-key (Strategy)
  readonly polling?: PollingDef           // optional: scheduled data pulls
  readonly backfill?: BackfillDef         // optional: historical import
  // No webhook, classifier, lifecycle — never receives inbound events
}

// ── Discriminated Union ───────────────────────────────────────────────────────

type ProviderDefinition<TConfig = unknown, TAccountInfo = BaseProviderAccountInfo> =
  | WebhookProvider<TConfig, TAccountInfo, Record<string, CategoryDef>, Record<string, EventDefinition>>
  | ApiProvider<TConfig, TAccountInfo, Record<string, CategoryDef>, Record<string, EventDefinition>>

// ── Type Guards ───────────────────────────────────────────────────────────────

function isWebhookProvider<T>(p: ProviderDefinition<T>): p is WebhookProvider<T, ...>
function isApiProvider<T>(p: ProviderDefinition<T>): p is ApiProvider<T, ...>

// ── Factories ─────────────────────────────────────────────────────────────────

function defineWebhookProvider<TConfig, TAccountInfo, TCategories, TEvents>(
  def: Omit<WebhookProvider<...>, "kind" | "env">
    & { defaultSyncEvents: readonly (keyof TCategories & string)[] }
): WebhookProvider<...>

function defineApiProvider<TConfig, TAccountInfo, TCategories, TEvents>(
  def: Omit<ApiProvider<...>, "kind" | "env">
    & { defaultSyncEvents: readonly (keyof TCategories & string)[] }
): ApiProvider<...>

// Backward-compat alias during migration (existing defineProvider calls unchanged)
const defineProvider = defineWebhookProvider

// ── New Type: EventClassifier ─────────────────────────────────────────────────

interface EventClassifier {
  classify(eventType: string, action?: string): "lifecycle" | "data" | "unknown"
}

// ── New Type: LifecycleDef ────────────────────────────────────────────────────

type LifecycleReason =
  | "provider_revoked"
  | "provider_suspended"
  | "provider_unsuspended"
  | "provider_repo_removed"
  | "provider_repo_deleted"

interface LifecycleDef {
  readonly events: Record<
    string,  // wire eventType (e.g. "installation", "repository")
    (action: string | undefined, payload: unknown) =>
      { reason: LifecycleReason; resourceIds?: string[] } | null
  >
}

// ── New Type: PollingDef ──────────────────────────────────────────────────────

interface PollingEntityHandler {
  readonly endpointId: string
  buildRequest(ctx: BackfillContext, cursor: unknown): {
    pathParams?: Record<string, string>
    queryParams?: Record<string, string>
    body?: unknown
  }
  processResponse(data: unknown, ctx: BackfillContext, cursor: unknown): {
    events: BackfillWebhookEvent[]  // same event shape as backfill — reuses Inngest pipeline
    nextCursor: unknown | null
    rawCount: number
  }
}

interface PollingDef {
  readonly defaultIntervalMs: number
  readonly entityTypes: Record<string, PollingEntityHandler>
}

// Typed cursor helper (same pattern as typedEntityHandler)
function typedPollingHandler<TCursor>(handler: { ... }): PollingEntityHandler
```

---

## 8. The `auth` Field Rename — Gateway Impact

The gateway's `connections.ts` currently calls `providerDef.oauth.*` in 7 places:

| Call site | Line | Purpose |
|-----------|------|---------|
| `providerDef.oauth.buildAuthUrl(config, state)` | 123 | Authorize URL |
| `providerDef.oauth.processCallback(config, query)` | 260 | OAuth callback |
| `providerDef.oauth.refreshToken(config, refresh)` | 562, 616 | Token refresh |
| `providerDef.oauth.getActiveToken(config, id, token)` | 582, 636 | Get active token |
| `providerDef.oauth.usesStoredToken` | 516 | Check token storage |

After the rename, all become `providerDef.auth.*`. The method signatures are identical — the
`oauth` field moves to `auth` on `WebhookProvider`, and `ApiProvider` uses the same `auth`
field with either `kind: "oauth"` or `kind: "api-key"`.

**The token vault works for API keys without any schema change.** `gatewayTokens.accessToken`
is already an encrypted string. For API-key providers, that string IS the API key. The gateway
decrypts it, calls `auth.getActiveToken(config, externalId, decryptedKey)`, and the API-key
implementation just returns it directly. Zero new infrastructure.

```ts
// API-key auth: getActiveToken is trivial
getActiveToken: (_config, _externalId, storedApiKey) => {
  if (!storedApiKey) throw new Error("no api key stored")
  return Promise.resolve(storedApiKey)
},
usesStoredToken: true  // always true for API-key providers — the key is the token
```

**Connection setup for API-key providers** replaces `processCallback` with `processSetup`:
```ts
// Called by a new POST /connections/api-key/setup endpoint (not an OAuth redirect)
processSetup: async (_config, { apiKey }) => ({
  status: "connected",
  externalId: "api-key",   // single installation per org for API-key providers
  accountInfo: { version: 1, sourceType: "apollo", events: [...], ... },
  tokens: { accessToken: apiKey, raw: {} },  // API key stored as accessToken
})
```

The gateway's callback endpoint is irrelevant for API-key providers. A new tRPC mutation
(or dedicated gateway endpoint) handles setup: receive API key from UI → call `processSetup`
→ store as installation + token record. Same upsert logic as the OAuth callback handler.

---

## 8a. Apollo/GTM Provider Shape — Proxy-Only (Illustrative)

This shows what a Tier 2 provider looks like:

### Variant A: Proxy-Only (no polling, no backfill)

Apollo queried on-demand by console tRPC. No scheduled jobs. No events emitted.

```ts
// packages/console-providers/src/providers/apollo/index.ts

export const apollo = defineApiProvider({
  name: "apollo",
  displayName: "Apollo",
  description: "Connect your Apollo GTM workspace",
  optional: true,

  envSchema: {},  // ← no server-side secrets; API key stored per-installation in token vault
  createConfig: (_env) => ({}),
  configSchema: z.object({}),

  auth: {
    kind: "api-key",   // ← Strategy: ApiKeyDef
    buildAuthHeader: (apiKey) => `Api-Key ${apiKey}`,
    getActiveToken: (_config, _externalId, storedApiKey) => {
      if (!storedApiKey) throw new Error("apollo: no api key stored")
      return Promise.resolve(storedApiKey)
    },
    usesStoredToken: true,
    processSetup: async (_config, { apiKey }) => ({
      status: "connected",
      externalId: "api-key",
      accountInfo: {
        version: 1 as const,
        sourceType: "apollo" as const,
        events: [],        // no webhook events
        installedAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
        raw: {},
      },
      tokens: { accessToken: apiKey, raw: {} },  // key stored as accessToken in vault
    }),
  },

  // Minimal events — display only (no ingest pipeline involvement)
  categories: {},
  events: {},
  defaultSyncEvents: [],
  buildProviderConfig: () => ({ provider: "apollo" as const }),
  resolveCategory: (et) => et,
  getBaseEventType: (st) => st,
  deriveObservationType: (st) => st,

  api: apolloApi,  // endpoints for proxy/execute calls from tRPC

  resourcePicker: {
    installationMode: "single",
    resourceLabel: "workspace",
    enrichInstallation: async (_executeApi, inst) => ({ ...inst, label: "Apollo Workspace" }),
    listResources: async (_executeApi) => [{ id: "workspace", name: "Apollo Workspace" }],
  },

  // No polling, no backfill, no edgeRules
})
```

**What the console can do with this:** tRPC procedures call `proxy/execute` to fetch contacts,
sequences, accounts on demand. The gateway handles auth injection. No Cron, no Inngest, no
QStash involvement.

### Variant B: With Polling (Apollo as an event source)

If Apollo data should flow through the Inngest pipeline as observable events:

```ts
export const apollo = defineApiProvider({
  // ... same auth, api, resourcePicker as above ...

  categories: {
    contact: { label: "Contacts", description: "Contact activity", type: "observation" },
  },
  events: {
    contact: simpleEvent({ label: "Contact", weight: 40, schema: apolloContactSchema, transform: transformApolloContact }),
  },
  defaultSyncEvents: ["contact"],

  polling: {
    defaultIntervalMs: 5 * 60 * 1000,
    entityTypes: {
      contact: typedPollingHandler<string | null>({
        buildRequest: (ctx, cursor) => ({
          queryParams: { updated_after: ctx.since, ...(cursor ? { cursor } : {}) },
        }),
        processResponse: (data, ctx, cursor) => ({
          events: [...],          // BackfillWebhookEvent[] shaped — same as backfill
          nextCursor: data.pagination?.cursor ?? null,
          rawCount: data.contacts?.length ?? 0,
        }),
      }),
    },
  },
})
```

**Key difference from WebhookProvider for both variants:**
- No `webhook`, `classifier`, `lifecycle` fields
- `auth.kind: "api-key"` instead of `oauth`
- No ingest route — the platform never expects inbound webhooks from this provider
- Proxy path unchanged — `POST /connections/:id/proxy/execute` works identically

---

## 9. Registry Impact

`registry.ts` needs two additions:

```ts
// 1. ProviderConfigMap gains apollo entry
interface ProviderConfigMap {
  readonly github: GitHubConfig
  readonly linear: LinearConfig
  readonly sentry: SentryConfig
  readonly vercel: VercelConfig
  readonly apollo: ApolloConfig  // ← new
}

// 2. Discriminated union type narrows correctly via `kind`
export function isWebhookProvider(p: ProviderDefinition): p is WebhookProvider<...> {
  return p.kind === "webhook"
}

export function isApiProvider(p: ProviderDefinition): p is ApiProvider<...> {
  return p.kind === "api"
}
```

The `EVENT_REGISTRY` derivation, `sourceTypeSchema`, `PROVIDER_ENVS()`, `getProvider()`,
`providerAccountInfoSchema`, `providerConfigSchema` all work unchanged — they operate on
`BaseProvider` fields that exist on both tiers.

---

## 10. Platform Architecture Integration

The new `define.ts` directly enables the architecture from the research doc:

### Platform Ingest Workflow (step 3 — classify)

```ts
// apps/platform/src/workflows/ingest-delivery.ts
// step 3: classify event

import { isWebhookProvider } from "@repo/console-providers"

const provider = getProvider(providerName)
if (!isWebhookProvider(provider)) {
  // API-only providers don't send webhooks — this path is unreachable in prod
  return "unknown"
}

const result = provider.classifier.classify(eventType, action)
```

### Platform Lifecycle Workflow (use lifecycle.events map)

```ts
// apps/platform/src/workflows/connection-lifecycle.ts

const provider = getProvider(providerName)
if (!isWebhookProvider(provider)) return  // API providers don't have lifecycle webhooks

const lifecycleResult = provider.lifecycle.events[eventType]?.(action, payload)
if (!lifecycleResult) return  // no lifecycle meaning for this event+action

const { reason, resourceIds } = lifecycleResult
// → pass to connectionLifecycleWorkflow(installationId, orgId, provider, reason, resourceIds)
```

### Polling Scheduler (Cron → ApiProvider)

```ts
// apps/platform/src/cron/poll-api-providers.ts

for (const [name, provider] of Object.entries(PROVIDERS)) {
  if (provider.kind !== "api") continue
  if (!provider.polling) continue

  // Schedule a Cron job per API provider per entity type
  for (const entityType of Object.keys(provider.polling.entityTypes)) {
    await schedulePoll({ providerName: name, entityType, intervalMs: provider.polling.defaultIntervalMs })
  }
}
```

---

## 11. Migration Plan

The existing 4 providers (GitHub, Linear, Sentry, Vercel) need minimal changes:

### Phase 1: Add `kind`, `classifier`, `lifecycle` to existing providers

**Change to each existing `index.ts`:**

```diff
- export const github = defineProvider({
+ export const github = defineWebhookProvider({
    // ... existing fields unchanged ...

+   classifier: {
+     classify(eventType) {
+       if (["installation", "installation_repositories", "repository"].includes(eventType)) return "lifecycle"
+       if (["pull_request", "issues", "push"].includes(eventType)) return "data"
+       return "unknown"
+     }
+   },

+   lifecycle: {
+     events: {
+       "installation": (action) => {
+         if (action === "deleted")   return { reason: "provider_revoked" }
+         if (action === "suspend")   return { reason: "provider_suspended" }
+         if (action === "unsuspend") return { reason: "provider_unsuspended" }
+         return null
+       },
+       "installation_repositories": (action, payload) => {
+         if (action !== "removed") return null
+         const ids = (payload as any).repositories_removed?.map((r: any) => String(r.id)) ?? []
+         return { reason: "provider_repo_removed", resourceIds: ids }
+       },
+     }
+   },
  })
```

**Risk: LOW** — additive only. Existing behavior unchanged. TypeScript enforces completeness.

### Phase 2: Update `define.ts` interface

1. Add `kind` discriminant to `ProviderDefinition`
2. Split into `WebhookProvider` and `ApiProvider` interfaces
3. Create `defineWebhookProvider()` and `defineApiProvider()` factories
4. Keep `defineProvider` as alias for `defineWebhookProvider` during transition
5. Add `EventClassifier`, `LifecycleDef`, `AuthStrategy`, `PollingDef` types

**Risk: LOW** — the factories are additive. The `defineProvider` alias means zero provider changes needed initially.

### Phase 3: Add Apollo/GTM as first ApiProvider

1. Create `packages/console-providers/src/providers/apollo/`
2. Use `defineApiProvider()` with `auth.kind: "api-key"`
3. Add to `PROVIDERS` registry
4. No relay/gateway changes needed yet

**Risk: LOW** — API providers don't touch the webhook pipeline at all.

### Phase 4: Remove `defineProvider` alias (cleanup)

After all providers are updated to use `defineWebhookProvider` or `defineApiProvider`,
remove the alias.

**Risk: LOW** — purely mechanical rename.

---

## 12. What Stays the Same

- All existing provider files (`github/index.ts`, `linear/index.ts`, etc.) compile without changes (alias ensures this)
- `dispatch.ts` — `transformWebhookPayload` works identically on `BaseProvider.events`
- `registry.ts` — `PROVIDERS`, `EVENT_REGISTRY`, `PROVIDER_ENVS()` all unchanged
- `post-transform-event.ts` — canonical output type unchanged
- `types.ts` — `OAuthTokens`, `CallbackResult`, `TransformContext` unchanged
- All `backfill`, `api`, `resourcePicker`, `edgeRules` definitions unchanged

## 13. What Gets Better

| Before | After |
|--------|-------|
| 8/24 lifecycle scenarios go to DLQ | `classifier` + `lifecycle` fix all 8 |
| No way to add Apollo/GTM (proxy-only) | `ApiProvider` with just `auth` + `api` |
| No way to add polling providers | `ApiProvider` with optional `polling` |
| `webhook` required on all providers | `webhook` only on `WebhookProvider` tier |
| `oauth` field name mixes concerns | `auth` field works for OAuth and API-key |
| Gateway calls `providerDef.oauth.*` | Gateway calls `providerDef.auth.*` (same interface) |
| API key providers need new token infra | Token vault already works — API key = `accessToken` |
| 6 generic type params | 4 generic type params |
| Classification logic in relay code | `classifier.classify()` in provider definition |
| Lifecycle handling scattered in gateway | `LifecycleDef` in provider, generic workflow |
| `defineProvider` must know all fields | `defineWebhookProvider` / `defineApiProvider` |

## 14. What Stays the Same

- All existing provider files compile unchanged (`defineProvider` alias for `defineWebhookProvider`)
- `dispatch.ts` — `transformWebhookPayload` reads `BaseProvider.events`, unchanged
- `registry.ts` — `PROVIDERS`, `EVENT_REGISTRY`, `PROVIDER_ENVS()` all unchanged
- `post-transform-event.ts` — canonical output type unchanged
- `types.ts` — `OAuthTokens`, `CallbackResult`, `TransformContext` unchanged
- `backfill`, `api`, `resourcePicker`, `edgeRules` definitions unchanged on all tiers
- `gatewayTokens` table — no schema change; API keys stored as `accessToken`
- `GET /:id/proxy/execute` route — unchanged logic; just `providerDef.oauth.*` → `providerDef.auth.*`

---

## Open Questions

1. **`PollingDef` cursor type**: Should it use the same `typedEntityHandler` cursor pattern
   as `BackfillDef`, or a new `typedPollingHandler` with a timestamp-based cursor?

2. **`AccountInfoSchema` for ApiProvider**: API-key providers have no OAuth tokens to store.
   Should `CallbackResult` have a `"connected-api-key"` status variant that omits `tokens`?

3. **Backfill vs Polling overlap**: `BackfillDef` and `PollingDef` are conceptually similar
   (paginated entity fetch with cursor). Could they share a base type?

4. **`processSetup` for API providers**: The `ApiKeyStrategy.processSetup` receives `{ apiKey }`.
   Should this also validate the key (call the provider API to confirm it works)?
   Answer: Yes — `validateKey` should be called here before storing.

5. **`gateway.ts` service contracts**: `GatewayConnection`, `ProxyExecuteRequest` etc. in
   `packages/console-providers/src/gateway.ts` reference installation-level concepts that
   only apply to webhook/OAuth providers. Should these be split too?

6. **Sentry's custom JWT auth**: Sentry uses a JWT-based installation token (not stored OAuth).
   It's currently in `providers/sentry/auth.ts`. In the new model it maps to `OAuthStrategy`
   with `usesStoredToken: false` and a custom `getActiveToken` — which works fine with no changes.
