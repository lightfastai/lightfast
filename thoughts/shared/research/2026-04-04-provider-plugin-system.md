---
date: 2026-04-04T20:00:00+08:00
researcher: claude
git_commit: fa1b286aa7e05f9dafbcd8081e720eecf4f1b7cd
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "Provider plugin system: lightweight providers + accretive connector growth"
tags: [research, codebase, providers, proxy, plugin-system, extensibility, accretive]
status: complete
last_updated: 2026-04-04
---

# Research: Provider Plugin System

**Date**: 2026-04-04
**Git Commit**: fa1b286aa7e05f9dafbcd8081e720eecf4f1b7cd
**Branch**: refactor/drop-workspace-abstraction

## Research Question

How to extend the provider system to support lightweight proxy-only providers (both Lightfast-curated and user-defined) alongside the existing full-featured providers, and whether an accretive model where Lightfast detects and suggests connectors based on usage signals is viable.

## Summary

The current provider system is a compile-time-enforced, three-kind architecture (webhook, managed, api) with a hard-coded registry of 5 providers. The proxy executor and token vault are already provider-agnostic — the barriers to extensibility are in the type system and registry, not the runtime infrastructure. A two-tier model emerges naturally: **full providers** (webhook + backfill + events, compile-time) and **lightweight providers** (proxy-only, same format for both Lightfast-curated and user-defined). The accretive detection model is viable — the system already captures service signals (env var names, dependency references, platform strings) that could drive connector suggestions.

---

## Part 1: Current Provider Architecture

### Provider Kind Hierarchy

Three provider kinds, discriminated by `kind` field (`provider/shape.ts:66-261`):

| Kind | Auth | Inbound | Backfill | Examples |
|---|---|---|---|---|
| `webhook` | OAuth / App-token | Signed webhook POST | Required | GitHub, Linear, Sentry, Vercel |
| `managed` | OAuth / API key | Programmatic webhook register/unregister | Optional | (no concrete impl yet) |
| `api` | OAuth / API key | Optional manual webhook | Optional | Apollo |

All three share `BaseProviderFields` (`shape.ts:18-64`) — 17+ required fields including events, categories, transformers, backfill, resourcePicker, and display metadata.

### The Registry (`registry.ts:20-26`)

```ts
export const PROVIDERS = { apollo, github, vercel, linear, sentry } as const;
```

`as const` freezes the key union. Every downstream type derives from `keyof typeof PROVIDERS`:

| Derived Type | Location | Mechanism |
|---|---|---|
| `EventKey` | `registry.ts:83-85` | Mapped type over provider events |
| `ProviderApiCatalog` | `registry.ts:209-215` | Manual interface listing each slug |
| `_GetEndpoint` | `registry.ts:244-267` | Conditional chain enumerating each slug |
| `eventKeySchema` | `registry.ts:131-132` | `z.enum(Object.keys(EVENT_REGISTRY))` |
| `providerAccountInfoSchema` | `registry.ts:144-147` | `z.discriminatedUnion` over all account schemas |
| `providerConfigSchema` | `registry.ts:160-163` | `z.discriminatedUnion` over all config schemas |
| `providerSlugSchema` | `client/display.ts:15-22` | `z.enum(["apollo", "github", ...])` |

### Compile-Time Coupling Points

| Location | Coupling | Effect |
|---|---|---|
| `client/display.ts:15-22` | `z.enum` literal tuple | No runtime extension API on Zod enums |
| `registry.ts:20-26` | `PROVIDERS` const | Key union frozen at compile time |
| `registry.ts:209-267` | `ProviderApiCatalog` + `_GetEndpoint` | Each slug manually enumerated |
| `contracts/wire.ts:9,33` | `provider: providerSlugSchema` | Wire schemas reject unknown slugs |
| `contracts/backfill.ts:9` | `provider: providerSlugSchema` | Backfill payloads reject unknown slugs |
| `client/categories.ts:6-115` | `Record<ProviderSlug, ...>` | Manual slug keys |
| `lib/provider-configs.ts:25-29` | Iterates `PROVIDERS` | Config map bounded by `PROVIDERS` |

### What's Already Provider-Agnostic

**Token helpers** (`api/platform/src/lib/token-helpers.ts:13-128`) dispatch through `auth.getActiveToken(config, externalId, storedAccessToken)` without any provider-name switching. All three auth strategies (`OAuthDef`, `ApiKeyDef`, `AppTokenDef`) share this same interface (`provider/auth.ts:23-27, 54-58, 92-96`).

**Proxy executor** (`api/platform/src/router/memory/proxy.ts:89-243`) works generically: validate endpoint exists → get token → build URL → inject auth → fetch → return raw response. No provider-specific logic.

**Token vault** (`gateway-installations` + `gateway-tokens`) stores encrypted credentials for all providers uniformly. The `provider` column is `varchar(50)` in PostgreSQL (not a database enum), only typed as `SourceType` in TypeScript.

**Factory functions** (`factory/api.ts:13-67`) work at runtime — `Object.freeze` prevents mutation, not creation. `defineApiProvider` can be called at any time with any conforming object.

---

## Part 2: Two-Tier Model

### Tier 1: Full Providers (Existing System)

Webhook + backfill + events + transformers + categories. Compile-time `PROVIDERS` registry. Each provider is a complete `ProviderDefinition` with 17+ required fields. Adding a new Tier 1 provider requires:

- New directory under `providers/`
- Auth, API, schemas, backfill, transformers files
- Registration in `PROVIDERS`, `providerSlugSchema`, `PROVIDER_DISPLAY`
- Env var configuration
- OAuth flow support in platform

Cost: significant engineering. Justified for providers that need real-time webhooks, backfill, and event pipeline integration.

### Tier 2: Lightweight Providers (New)

Proxy-only. One format covering both Lightfast-curated (PlanetScale, Pinecone, Clerk) and user-defined custom APIs. The user adds an API key once, and the provider is callable through the proxy.

**Minimum viable definition:**

```typescript
interface LightweightProvider {
  slug: string;                    // e.g., "planetscale", "custom:my-api"
  displayName: string;
  description: string;
  baseUrl: string;                 // e.g., "https://api.planetscale.com/v1"
  authHeaderFormat: string;        // e.g., "Bearer {token}", "Api-Key {token}"
  defaultHeaders?: Record<string, string>;
  endpoints: Record<string, {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;                  // e.g., "/organizations/{org}/databases"
    description: string;
    timeout?: number;
  }>;
}
```

**What this does NOT need:**
- Events, categories, transformers
- Webhook verification (signatureScheme, headersSchema, extractEventType)
- Backfill handlers (entityTypes, buildRequest, processResponse)
- OAuth flow (buildAuthUrl, exchangeCode, refreshToken)
- Env vars (no server-side secrets — API key is stored per-installation)
- ResourcePicker, healthCheck, edgeRules
- `createConfig`, `configSchema`, `envSchema`

This is a strict subset of `ProviderApi` + display metadata. Apollo already demonstrates this shape in production.

### Shared Infrastructure

Both tiers share:

1. **Token vault** — Same `gatewayInstallations` + `gatewayTokens` tables. Lightweight providers store the API key as encrypted `accessToken`.

2. **Proxy executor** — Same `proxyRouter.execute`. Resolution chain:
   ```
   getProvider(slug) → PROVIDERS[slug]     // Tier 1
                     → CATALOG[slug]       // Tier 2 curated
                     → loadCustom(orgId)   // Tier 2 user-defined
   ```

3. **Encryption** — Same AES-256-GCM for all credentials.

4. **Public API** — Same `proxy.search` + `proxy.call` (or `proxy.execute`). Lightweight providers appear in search results alongside full providers.

### `providerConfigs` for Lightweight Providers

First-party providers derive config from env vars. API-key providers don't use config for token resolution — Apollo's `getActiveToken` returns `storedAccessToken` directly and ignores `config`. For lightweight providers, `config = {}` works. The `config as never` escape hatch in `token-helpers.ts` is safe for this case.

### The `provider` Column

Current: `varchar(50)` typed as `SourceType`. Options for lightweight providers:

- **Approach A**: Relax `SourceType` to include a catch-all pattern. The DB column is already a free-form string — only TypeScript types constrain it.
- **Approach B**: Use a reserved prefix (`"lw:"` or `"custom:"`) that the resolver recognizes as lightweight.
- **Approach C**: Store lightweight provider slug directly (e.g., `"planetscale"`) and extend `providerSlugSchema` or bypass it for the proxy path.

The wire contract schemas (`contracts/wire.ts`, `contracts/backfill.ts`) validate `provider` against `providerSlugSchema`, but lightweight providers don't flow through those schemas — they never receive webhooks or trigger backfills.

### Storage for Lightweight Provider Definitions

Two viable patterns:

**Pattern A: Database table**
```
lightfast_provider_definitions (new table)
  id, orgId (nullable — null for Lightfast-curated), slug, displayName,
  description, baseUrl, authHeaderFormat, defaultHeaders (jsonb),
  endpoints (jsonb), createdBy, createdAt, updatedAt
```
Lightfast-curated definitions have `orgId = null` (global). User-defined have `orgId` set.

**Pattern B: JSONB on installation**
No new table. The `providerAccountInfo` or a new `providerDefinition` JSONB column on `gatewayInstallations` carries the lightweight definition inline. Simpler but harder to share definitions across installations.

---

## Part 3: External Platform Patterns

### Managed Catalog Models

| Platform | Definition Format | Custom Connector | Auth Storage | Proxy |
|---|---|---|---|---|
| **Nango** | YAML (`providers.yaml`, 600+ entries) | Yes — "Private API Bearer" escape hatch + generic API providers | Encrypted DB, auto-refresh, customer-managed key on self-host | Full proxy (`/proxy/:connectionId`) |
| **Composio** | Internal (1,000+ toolkits) | OpenAPI import, experimental custom toolkits | Auth Configs API, managed storage + refresh | No generic proxy — tool execution only |
| **Arcade** | Python TDK (same format for first-party and custom) | Yes — identical authoring model | OAuth vault with auth interrupts | No proxy — tool functions make HTTP calls directly |
| **Paragon** | Visual workflow UI + Custom Integration Builder (form-based) | Yes — form UI: baseUrl, auth type, endpoint templates | Paragon-managed, not exposed | No generic proxy — workflow steps |
| **Merge** | Internal only (7 categories, 100+ integrations) | No. Passthrough proxy for existing catalog only | Merge-managed, not exposed | Passthrough (Pro/Enterprise) |

### Key Takeaways

1. **Nango's "Private API Bearer"** is closest to the lightweight provider model — minimal definition (baseUrl + auth type), proxy-able, no code required.
2. **Composio's meta-tool discovery** (search_toolkits → enable_toolkit → get_tools) solves the context-bloat problem for AI agents with many connectors.
3. **Arcade's identical authoring model** for first-party and custom tools eliminates the tiering distinction — the same format serves both.
4. **Nobody exposes OpenAPI auto-import as a smooth UX** — Composio's is legacy v1, Paragon's is form-based.

### References

- Nango providers.yaml: https://github.com/NangoHQ/nango/blob/master/packages/providers/providers.yaml
- Nango custom integrations: https://docs.nango.dev/guides/custom-integrations/overview
- Nango proxy: https://nango.dev/docs/guides/primitives/proxy
- Composio custom tools: https://docs.composio.dev/docs/toolkits/custom-tools-and-toolkits
- Arcade TDK: https://docs.arcade.dev/en/guides/create-tools/tool-basics
- Paragon Custom Integration Builder: https://docs.useparagon.com/resources/custom-integrations
- Port.io Catalog Discovery: https://port.io/blog/catalog-discovery

---

## Part 4: Accretive Detection Model

### Signals Already in the System

| Signal | Source | Location | Detection Method |
|---|---|---|---|
| Env var names in PR bodies | Entity extraction regex | `entity-extraction-patterns.ts:44-49` | `[A-Z][A-Z0-9_]{2,}(?:_[A-Z0-9]+)+` pattern → `"config"` entities |
| Sentry platform strings | Event attributes | `sentry/transformers.ts:76` | `attributes.platform` = `"python"`, `"node"`, etc. |
| Vercel framework detection | Vercel project metadata | `vercel/api.ts:50` | `framework` field on project objects |
| GitHub repo file contents | Proxy endpoint | `github/api.ts:154-169` | `get-file-contents` reads any file from connected repos |
| PR/issue body text | Event storage | `lightfast_org_events.content` | Up to 50k chars of free text, rich with tool mentions |
| File path references | Entity extraction regex | `entity-extraction-patterns.ts:52-57` | `src/`, `packages/`, etc. → `"definition"` entities |
| API route mentions | Entity extraction regex | `entity-extraction-patterns.ts:20-26` | `GET /path`, `POST /api/...` → `"endpoint"` entities |

### The `"service"` Entity Category

The entity category schema (`entities.ts:21`) defines `"service"` mapped to "External services, dependencies" — but **no extraction pattern populates it**. The `EXTRACTION_PATTERNS` array at `entity-extraction-patterns.ts:17-77` has patterns for endpoint, project, config, definition, and reference — but not service.

### Viable Detection Approaches

**Passive (observe what's already flowing):**
- Add service detection patterns to `EXTRACTION_PATTERNS` mapping env var prefixes to known services:
  - `PLANETSCALE_*` → PlanetScale
  - `PINECONE_*` → Pinecone  
  - `CLERK_*` → Clerk
  - `STRIPE_*` → Stripe
  - `REDIS_*` / `UPSTASH_*` → Upstash/Redis
  - `OPENAI_*` → OpenAI
  - `SENDGRID_*` → SendGrid
- These would populate `"service"` entities from PR/issue body text with zero additional API calls

**Active (scan connected repos):**
- Use the existing `get-file-contents` GitHub proxy endpoint to read `package.json` from connected repos
- Parse `dependencies`/`devDependencies` for known SDK packages:
  - `@clerk/nextjs` → Clerk
  - `@planetscale/database` → PlanetScale
  - `@pinecone-database/pinecone` → Pinecone
  - `@upstash/redis` → Upstash
- Could run once at connection time or periodically via Inngest cron

### The Accretive Growth Loop

```
Tier 2 user-defined → most popular custom providers detected across orgs
  → Lightfast curates: pre-defines endpoints, adds to catalog
  → Detection signals trigger suggestions for new orgs
  → Some eventually graduate to Tier 1 (full webhook + backfill support)

                    ┌─────────────────────────────┐
                    │  Detection Signals           │
                    │  (env vars, deps, events)    │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │  Suggestion Layer            │
                    │  "We detected PlanetScale    │
                    │   in your stack. Connect?"   │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼───────┐ ┌─────▼──────┐ ┌───────▼──────────┐
    │ In catalog?      │ │ Not yet?   │ │ Unknown API?     │
    │ → One-click      │ │ → Add to   │ │ → User defines   │
    │   connect        │ │   roadmap  │ │   custom provider│
    └─────────────────┘ └────────────┘ └──────────────────┘
```

### External Precedent for Accretive Detection

| Platform | Detection Mechanism | Provision | Status |
|---|---|---|---|
| **Port.io Catalog Discovery** | AI scans GitHub repos → infers services/tech stack | Auto-populates software catalog, suggests integrations | Open beta (Jan 2026), closest to full loop |
| **Vercel `@vercel/fs-detectors`** | Reads sentinel files (package.json, config files) | Auto-configures build env | Open source, Apache-2.0. Detection not wired to integration suggestions |
| **GitHub Dependency Graph** | Parses manifests across 20+ ecosystems | Powers Dependabot security alerts | Not used for Marketplace integration suggestions |
| **Nixpacks** | Manifest-based runtime detection | Auto-configures build + start commands | Stops at build layer, not service layer |
| **Zapier** | In-product search queries + usage pattern analysis | Demand signal → connector roadmap | Proven at scale, reactive not proactive |

Nobody has shipped the full "detect SDK in repo → suggest connector → auto-provision" pipeline at production scale. Port.io is closest. The inference layer (SDK import → service identity mapping) is the unsolved gap industry-wide.

References:
- Port.io Catalog Discovery: https://port.io/blog/catalog-discovery
- Vercel fs-detectors: https://github.com/vercel/vercel/tree/main/packages/fs-detectors
- GitHub dependency graph: https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-graph-data
- Nixpacks: https://nixpacks.com/docs/how-it-works
- Zapier integration lessons: https://zapier.com/engineering/integration-lessons/
- mitmproxy2swagger (traffic → OpenAPI spec): https://github.com/alufers/mitmproxy2swagger

---

## Part 5: Two-Tier Coexistence — Technical Sketch

### Proxy Execution Flow (Both Tiers)

```
proxyRouter.execute(installationId, endpointId, params)
  │
  ├─ Query gatewayInstallations by installationId
  │
  ├─ Read provider slug from row
  │
  ├─ Resolve provider definition:
  │    ├─ PROVIDERS[slug]          → Tier 1 ProviderDefinition
  │    └─ loadLightweight(slug)    → Tier 2 LightweightProvider
  │         ├─ CATALOG[slug]       (Lightfast-curated, global)
  │         └─ DB lookup by orgId  (user-defined, org-scoped)
  │
  ├─ Extract ProviderApi-compatible object:
  │    ├─ Tier 1: providerDef.api
  │    └─ Tier 2: { baseUrl, endpoints, buildAuthHeader, defaultHeaders }
  │
  ├─ Resolve token:
  │    ├─ Tier 1: getActiveTokenForInstallation(installation, config, providerDef)
  │    └─ Tier 2: decrypt(gatewayTokens.accessToken) — API key returned directly
  │
  ├─ Build URL (same logic: base + path template + params)
  ├─ Inject auth header (same logic: buildAuthHeader(token))
  ├─ Fetch with timeout + 401 retry
  └─ Return { status, data, headers }
```

### What Changes vs. What Stays

| Component | Change Required | Notes |
|---|---|---|
| `proxyRouter.execute` | Small branching on provider resolution | Core fetch logic unchanged |
| `getActiveTokenForInstallation` | None | Already generic — dispatches through `auth.getActiveToken` |
| `gatewayInstallations` table | None | `provider` is already `varchar(50)` |
| `gatewayTokens` table | None | Same AES-256-GCM encrypted storage |
| `token-store.ts` (write/update) | None | Same encryption flow |
| `providerSlugSchema` | No change needed if Tier 2 bypasses wire schemas | Tier 2 never flows through webhook/backfill contracts |
| `PROVIDERS` const | No change | Tier 1 stays compile-time |
| `provider-configs.ts` | Small change | Add fallback for Tier 2 (return `{}` config) |
| New: provider catalog | New | Either DB table or code-level catalog for Tier 2 definitions |
| New: connection setup UI | New | API key input flow for lightweight providers |

### Minimal `auth.getActiveToken` for Lightweight Providers

Lightweight providers all use API-key auth. The `getActiveToken` implementation is trivially:

```typescript
getActiveToken: (_config, _externalId, storedAccessToken) => {
  if (!storedAccessToken) throw new Error("no api key stored");
  return Promise.resolve(storedAccessToken);
}
```

This is identical to Apollo's implementation (`providers/apollo/index.ts:37-46`). The token helpers already handle the vault decryption before calling this function.

---

## Code References

### Provider Architecture
- `packages/app-providers/src/provider/shape.ts:18-64` — `BaseProviderFields` interface
- `packages/app-providers/src/provider/shape.ts:66-261` — `WebhookProvider`, `ManagedProvider`, `ApiProvider` definitions
- `packages/app-providers/src/provider/api.ts:48-99` — `ProxyExecuteRequest`, `ProviderApi`, `ApiEndpoint`
- `packages/app-providers/src/provider/auth.ts:8-124` — `OAuthDef`, `ApiKeyDef`, `AppTokenDef`
- `packages/app-providers/src/provider/webhook.ts:28-131` — `SignatureScheme`, `WebhookDef`, `ManagedWebhookDef`

### Registry & Type Lattice
- `packages/app-providers/src/registry.ts:20-26` — `PROVIDERS` const
- `packages/app-providers/src/registry.ts:83-85` — `EventKey` derived type
- `packages/app-providers/src/registry.ts:131-132` — `eventKeySchema`
- `packages/app-providers/src/registry.ts:144-147` — `providerAccountInfoSchema`
- `packages/app-providers/src/registry.ts:160-163` — `providerConfigSchema`
- `packages/app-providers/src/registry.ts:209-267` — `ProviderApiCatalog`, `_GetEndpoint`
- `packages/app-providers/src/registry.ts:340-347` — `getProvider()` overloads
- `packages/app-providers/src/client/display.ts:15-22` — `providerSlugSchema`

### Factory Functions
- `packages/app-providers/src/factory/api.ts:13-67` — `defineApiProvider`
- `packages/app-providers/src/factory/webhook.ts:17-75` — `defineWebhookProvider`
- `packages/app-providers/src/factory/managed.ts:17-70` — `defineManagedProvider`

### Proxy Execution
- `api/platform/src/router/memory/proxy.ts:89-243` — `proxyRouter.execute`
- `api/platform/src/lib/token-helpers.ts:13-128` — `getActiveTokenForInstallation`, `forceRefreshToken`
- `api/platform/src/lib/provider-configs.ts:22-62` — Lazy config singleton
- `apps/app/src/lib/proxy.ts:79-121` — `proxyExecuteLogic` (app-layer orchestration)

### Token Vault
- `db/app/src/schema/tables/gateway-installations.ts:16-91` — `gatewayInstallations` table
- `db/app/src/schema/tables/gateway-tokens.ts:12-43` — `gatewayTokens` table
- `api/platform/src/lib/token-store.ts:12-100` — `writeTokenRecord`, `updateTokenRecord`
- `packages/lib/src/encryption.ts:101-170` — AES-256-GCM `encrypt`/`decrypt`

### Entity Detection Signals
- `api/platform/src/lib/entity-extraction-patterns.ts:17-77` — `EXTRACTION_PATTERNS`
- `packages/app-validation/src/schemas/entities.ts:9-24` — `entityCategorySchema` (includes unused `"service"`)
- `packages/app-providers/src/providers/github/api.ts:154-169` — `get-file-contents` endpoint
- `packages/app-providers/src/providers/sentry/transformers.ts:76` — `attributes.platform`
- `packages/app-providers/src/providers/vercel/api.ts:50` — Vercel project `framework` field

### Concrete Provider (Apollo — Tier 2 precedent)
- `packages/app-providers/src/providers/apollo/index.ts:11-85` — Full `defineApiProvider` call
- `packages/app-providers/src/providers/apollo/api.ts:20-51` — `apolloApi` definition
- `packages/app-providers/src/providers/apollo/auth.ts` — `ApolloConfig`, `ApolloAccountInfo`

### Wire Contracts (Tier 1 only — Tier 2 bypasses these)
- `packages/app-providers/src/contracts/wire.ts:9,33` — `provider: providerSlugSchema`
- `packages/app-providers/src/contracts/backfill.ts:9` — `provider: providerSlugSchema`
- `packages/app-validation/src/schemas/workflow-io.ts:1,24` — `sourceTypeSchema` in Inngest payloads

### Hard-coded Provider Names (outside registry)
- `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:189` — `["github", "sentry"].includes(provider)`
- `api/platform/src/router/memory/backfill.ts:242` — Same literal list, duplicated

## Open Questions

1. **Where should Tier 2 definitions live?** DB table (queryable, org-scoped) vs. code-level catalog (versioned, type-safe) vs. hybrid (Lightfast-curated in code, user-defined in DB).

2. **How should the `provider` column evolve?** Relax `SourceType` to accept any string? Use a prefix convention? Or keep `SourceType` strict and add a separate column for provider tier?

3. **Should Tier 2 providers appear in `proxy.search` the same way as Tier 1?** Or should there be a distinct section in the search response?

4. **What's the Tier 2 → Tier 1 graduation path?** When a lightweight provider gets popular enough to justify webhooks + backfill, how does the definition migrate without breaking existing installations?

5. **Detection cadence:** Should repo scanning (active detection) run on every backfill, on a cron, or on-demand when the user visits a "discover connectors" page?

6. **Multi-org Tier 2 definitions:** If multiple orgs define the same custom provider (e.g., PlanetScale), should Lightfast detect convergence and promote to curated?
