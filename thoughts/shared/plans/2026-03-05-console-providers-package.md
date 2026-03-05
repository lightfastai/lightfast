# `@repo/console-providers` — Unified Provider Package

## Overview

Create a single `@repo/console-providers` package that replaces the scattered provider logic across 4+ packages with a unified, pure-function architecture. Each provider is a const object created via `defineProvider()` — no classes, no instantiation for metadata access, no framework coupling. Config schemas are Zod. All functions are pure (config as first arg, no env reads, no DB, no Hono).

**Replaces**: `console-types/src/provider.ts`, `console-webhooks/` (entire package), `relay/src/providers/impl/`, `relay/src/providers/schemas.ts`, `gateway/src/providers/impl/`, `gateway/src/providers/schemas.ts`, `gateway/src/providers/types.ts`, `relay/src/providers/types.ts`, `gateway/src/lib/github-jwt.ts`.

## Current State Analysis

Provider knowledge is scattered across 4+ locations with duplicated schemas, unsafe casts, separate interfaces for the same concept, and DB/framework coupling inside provider classes:

| Location | What it knows | Problems |
|---|---|---|
| `packages/console-types/src/provider.ts` | EVENT_REGISTRY (50+ entries), PROVIDER_REGISTRY, EventPreTransformMap, 6 compile-time assertions | Imports from `@repo/console-webhooks` for types |
| `packages/console-webhooks/` | Zod schemas, transformer functions, dispatch table | 15 `as` casts in dispatch.ts |
| `apps/relay/src/providers/` | `WebhookProvider` interface, loose `.passthrough()` Zod schemas, HMAC verification | Env accessed via `getWebhookSecret(env)` param |
| `apps/gateway/src/providers/` | `ConnectionProvider` interface, OAuth flows, token resolution | DB operations inside `handleCallback`, reads `env` at module level, takes Hono `Context` |
| `apps/gateway/src/lib/github-jwt.ts` | Web Crypto RS256 JWT signing, installation token/details | Reads `env.GITHUB_APP_ID` directly |
| `apps/gateway/src/providers/schemas.ts` | OAuth response Zod schemas (4 providers) + Sentry token encoding | `zod/v3` import |

### Key Problems
1. **Two interfaces for one concept**: `ConnectionProvider` (gateway) and `WebhookProvider` (relay) describe the same provider
2. **DB operations inside provider classes**: `handleCallback` does upserts into `gwInstallations`, reads `gwTokens`, calls `writeTokenRecord` — infra concerns leaking into provider logic
3. **Framework coupling**: `handleCallback(c: Context, ...)` takes Hono context, reads query params via `c.req.query()`
4. **Env coupling**: Gateway providers import `env` at module level; relay providers take `env` as a method param — inconsistent patterns
5. **Unsafe dispatch**: 15 `as` casts in `dispatch.ts`
6. **Schema duplication**: Relay has loose `.passthrough()` schemas, console-webhooks has detailed schemas
7. **Adding a provider touches 4+ files across 3 packages**
8. **Conditional provider registration**: Gateway checks `process.env` at module load for Linear/Sentry availability

## Desired End State

One package. One `defineProvider()` call per provider. Adding a new provider = 1 new file + 1 import line in `index.ts`. Everything else (metadata, schemas, transforms, OAuth, webhook verification) is derived from the provider definition.

**Architecture principle**: Provider definitions are pure data + pure functions. They never read env, never touch DB, never import framework types. Config is passed as the first argument to every function that needs it.

### Package Structure
```
packages/console-providers/
  src/
    index.ts                    # THE registry: imports + re-exports all providers as PROVIDERS const
    define.ts                   # defineProvider() + defineEvent() helpers, types
    types.ts                    # OAuthTokens, CallbackResult, TransformContext
    crypto.ts                   # computeHmac(), timingSafeEqual() — Web Crypto
    jwt.ts                      # createRS256JWT(), importPKCS8Key() — Web Crypto (from github-jwt.ts)
    sanitize.ts                 # Content sanitization (from console-webhooks)
    validation.ts               # PostTransform validation (from console-webhooks)
    dispatch.ts                 # transformWebhookPayload() — generic, zero casts
    providers/
      github.ts                 # defineProvider({ name: "github", ... })
      vercel.ts                 # defineProvider({ name: "vercel", ... })
      linear.ts                 # defineProvider({ name: "linear", ... })
      sentry.ts                 # defineProvider({ name: "sentry", ... })
    schemas/
      github.ts                 # GitHub pre-transform Zod schemas (from console-webhooks)
      vercel.ts                 # Vercel pre-transform Zod schemas
      linear.ts                 # Linear pre-transform Zod schemas
      sentry.ts                 # Sentry pre-transform Zod schemas
  package.json
  tsconfig.json
  tsup.config.ts
```

### Verification
- `pnpm typecheck` passes across all packages
- `pnpm lint` passes
- `pnpm test` passes
- No `as` casts in dispatch logic
- Zero infra deps: only `zod`, `@repo/console-validation`, web platform APIs (fetch, crypto.subtle)
- Adding a new provider requires exactly 2 touchpoints: provider file + 1 import line in index.ts
- Gateway routes become generic (no provider switch/strategy)
- Relay routes become generic (no provider switch/strategy)

## What We're NOT Doing

- **Not changing PostTransformEvent schema**: Stays in `@repo/console-validation`
- **Not changing the relay-to-console QStash contract**: `WebhookEnvelope` shape stays the same
- **Not adding new providers or events**: Pure refactor, same functionality
- **Not moving DB operations**: DB inserts/queries stay in service routes
- **Not moving token encryption**: `encrypt`/`decrypt` stay in services that need `@repo/lib`
- **Not moving token resolution/refresh**: `resolveToken()` stays in gateway routes as an infra concern
- **Not using Zod `z.registry()`**: It's schema-identity-keyed (WeakMap semantics) with no iteration or string lookup — wrong tool for a provider registry

## Implementation Approach

### Core Design: `defineProvider()` Const Objects

Each provider is a frozen const object, not a class instance. No constructor, no `this`, no state. Every function takes config as its first argument.

```ts
// define.ts

import type { z } from "zod";
import type { PostTransformEvent, SourceType } from "@repo/console-validation";
import type { TransformContext, OAuthTokens, CallbackResult } from "./types";

export interface CategoryDef {
  label: string;
  description: string;
  type: "observation" | "sync+observation";
}

export interface EventDefinition<S extends z.ZodType = z.ZodType> {
  label: string;
  weight: number;
  schema: S;
  transform: (payload: z.infer<S>, ctx: TransformContext) => PostTransformEvent;
}

/** Type-safe event definition — enforces schema<->transform consistency */
export function defineEvent<S extends z.ZodType>(
  def: EventDefinition<S>,
): EventDefinition<S> {
  return def;
}

/** Webhook extraction functions — pure, no env/DB/framework */
export interface WebhookDef<TConfig> {
  extractSecret: (config: TConfig) => string;
  verifySignature: (rawBody: string, headers: Headers, secret: string) => Promise<boolean>;
  extractEventType: (headers: Headers, payload: unknown) => string;
  extractDeliveryId: (headers: Headers, payload: unknown) => string;
  extractResourceId: (payload: unknown) => string | null;
  parsePayload: (raw: unknown) => unknown;
}

/** OAuth functions — pure fetch, no env/DB/framework */
export interface OAuthDef<TConfig> {
  buildAuthUrl: (config: TConfig, state: string, options?: Record<string, unknown>) => string;
  exchangeCode: (config: TConfig, code: string, redirectUri: string) => Promise<OAuthTokens>;
  refreshToken: (config: TConfig, refreshToken: string) => Promise<OAuthTokens>;
  revokeToken: (config: TConfig, accessToken: string) => Promise<void>;
  /** Extract params from callback query string, call provider APIs, return result. No DB, no Hono. */
  processCallback: (config: TConfig, query: Record<string, string>) => Promise<CallbackResult>;
}

export interface ProviderDefinition<TConfig = unknown> {
  readonly name: SourceType;
  readonly displayName: string;
  readonly description: string;
  readonly configSchema: z.ZodType<TConfig>;
  readonly categories: Record<string, CategoryDef>;
  readonly events: Record<string, EventDefinition>;
  readonly webhook: WebhookDef<TConfig>;
  readonly oauth: OAuthDef<TConfig>;
  /** Provider-specific capabilities (e.g., GitHub JWT, Linear GraphQL) */
  readonly capabilities?: Record<string, (...args: unknown[]) => unknown>;
  /** Normalize wire eventType to dispatch category key. Default: identity. */
  readonly resolveCategory?: (eventType: string) => string;
}

/** Create a type-safe provider definition */
export function defineProvider<TConfig>(
  def: ProviderDefinition<TConfig>,
): ProviderDefinition<TConfig> {
  return Object.freeze(def);
}
```

### Types (Zod-First)

```ts
// types.ts

import { z } from "zod";
import type { SourceType } from "@repo/console-validation";

export interface TransformContext {
  deliveryId: string;
  receivedAt: Date;
  eventType: string;
}

// ── OAuth Types ──

export const oAuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  scope: z.string().optional(),
  tokenType: z.string().optional(),
  raw: z.record(z.unknown()),
});

export type OAuthTokens = z.infer<typeof oAuthTokensSchema>;

export const callbackResultSchema = z.object({
  externalId: z.string(),
  accountInfo: z.object({
    version: z.literal(1),
    sourceType: z.custom<SourceType>(),
    events: z.array(z.string()),
    installedAt: z.string(),
    lastValidatedAt: z.string(),
    raw: z.unknown(),
  }).passthrough(),
  tokens: oAuthTokensSchema.optional(),
  setupAction: z.string().optional(),
  nextUrl: z.string().optional(),
});

export type CallbackResult = z.infer<typeof callbackResultSchema>;

// ── Provider Config Schemas ──

export const githubConfigSchema = z.object({
  appSlug: z.string(),
  appId: z.string(),
  privateKey: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  webhookSecret: z.string(),
});

export type GitHubConfig = z.infer<typeof githubConfigSchema>;

export const vercelConfigSchema = z.object({
  integrationSlug: z.string(),
  clientSecretId: z.string(),
  clientIntegrationSecret: z.string(),
});

export type VercelConfig = z.infer<typeof vercelConfigSchema>;

export const linearConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  webhookSigningSecret: z.string(),
});

export type LinearConfig = z.infer<typeof linearConfigSchema>;

export const sentryConfigSchema = z.object({
  appSlug: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
});

export type SentryConfig = z.infer<typeof sentryConfigSchema>;

// ── Sentry Token Encoding ──

export interface SentryInstallationToken {
  installationId: string;
  token: string;
}

export function encodeSentryToken(t: SentryInstallationToken): string {
  if (t.installationId.includes(":")) {
    throw new Error("installationId must not contain ':'");
  }
  return `${t.installationId}:${t.token}`;
}

export function decodeSentryToken(raw: string): SentryInstallationToken {
  const idx = raw.indexOf(":");
  if (idx === -1) {
    throw new Error("Invalid Sentry token: missing ':' separator");
  }
  return { installationId: raw.slice(0, idx), token: raw.slice(idx + 1) };
}
```

### Provider Example (GitHub)

```ts
// providers/github.ts

import { z } from "zod";
import { defineProvider, defineEvent } from "../define";
import type { GitHubConfig, OAuthTokens, CallbackResult } from "../types";
import { githubConfigSchema } from "../types";
import { computeHmac, timingSafeEqual } from "../crypto";
import { createRS256JWT } from "../jwt";
import {
  preTransformGitHubPushEventSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubReleaseEventSchema,
  preTransformGitHubDiscussionEventSchema,
  githubWebhookPayloadSchema,
} from "../schemas/github";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "../transformers/github";

// ── OAuth Response Schema ──

const githubOAuthResponseSchema = z.union([
  z.object({ access_token: z.string(), token_type: z.string(), scope: z.string() }),
  z.object({ error: z.string(), error_description: z.string(), error_uri: z.string() }),
]);

// ── GitHub-Specific Capabilities ──

async function createGitHubAppJWT(config: GitHubConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return createRS256JWT(
    { iss: config.appId, iat: now - 60, exp: now + 600 },
    config.privateKey,
  );
}

async function getInstallationToken(config: GitHubConfig, installationId: string): Promise<string> {
  if (!/^\d+$/.test(installationId)) throw new Error("Invalid GitHub installation ID: must be numeric");

  const jwt = await createGitHubAppJWT(config);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "lightfast-gateway",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) throw new Error(`GitHub installation token request failed: ${response.status}`);

  const data = (await response.json()) as Record<string, unknown>;
  if (typeof data.token !== "string" || data.token.length === 0) {
    throw new Error("GitHub installation token response missing valid token");
  }
  return data.token;
}

async function getInstallationDetails(config: GitHubConfig, installationId: string): Promise<{
  account: { login: string; id: number; type: string; avatar_url: string };
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
}> {
  if (!/^\d+$/.test(installationId)) throw new Error("Invalid GitHub installation ID: must be numeric");

  const jwt = await createGitHubAppJWT(config);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "lightfast-gateway",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) throw new Error(`GitHub installation details fetch failed: ${response.status}`);

  const data = (await response.json()) as Record<string, unknown>;
  const account = data.account as Record<string, unknown> | null;
  if (!account || typeof account.login !== "string") {
    throw new Error("GitHub installation response missing account data");
  }

  return {
    account: {
      login: account.login,
      id: account.id as number,
      type: account.type === "User" ? "User" : "Organization",
      avatar_url: (account.avatar_url as string | undefined) ?? "",
    },
    permissions: (data.permissions as Record<string, string> | undefined) ?? {},
    events: (data.events as string[] | undefined) ?? [],
    created_at: (data.created_at as string | undefined) ?? new Date().toISOString(),
  };
}

// ── Provider Definition ──

export const github = defineProvider({
  name: "github" as const,
  displayName: "GitHub",
  description: "Connect your GitHub repositories",
  configSchema: githubConfigSchema,

  categories: {
    push: { label: "Push", description: "Sync files and capture observations when code is pushed", type: "sync+observation" },
    pull_request: { label: "Pull Requests", description: "Capture PR opens, merges, closes, and reopens", type: "observation" },
    issues: { label: "Issues", description: "Capture issue opens, closes, and reopens", type: "observation" },
    release: { label: "Releases", description: "Capture published releases", type: "observation" },
    discussion: { label: "Discussions", description: "Capture discussion threads and answers", type: "observation" },
  },

  events: {
    push: defineEvent({ label: "Push", weight: 30, schema: preTransformGitHubPushEventSchema, transform: transformGitHubPush }),
    pull_request: defineEvent({ label: "Pull Requests", weight: 50, schema: preTransformGitHubPullRequestEventSchema, transform: transformGitHubPullRequest }),
    issues: defineEvent({ label: "Issues", weight: 45, schema: preTransformGitHubIssuesEventSchema, transform: transformGitHubIssue }),
    release: defineEvent({ label: "Releases", weight: 75, schema: preTransformGitHubReleaseEventSchema, transform: transformGitHubRelease }),
    discussion: defineEvent({ label: "Discussions", weight: 35, schema: preTransformGitHubDiscussionEventSchema, transform: transformGitHubDiscussion }),
  },

  webhook: {
    extractSecret: (config) => config.webhookSecret,
    verifySignature: async (rawBody, headers, secret) => {
      const sig = headers.get("x-hub-signature-256");
      if (!sig) return false;
      const received = sig.startsWith("sha256=") ? sig.slice(7) : sig;
      const expected = await computeHmac(rawBody, secret, "SHA-256");
      return timingSafeEqual(received, expected);
    },
    extractEventType: (headers) => headers.get("x-github-event") ?? "unknown",
    extractDeliveryId: (headers) => headers.get("x-github-delivery") ?? crypto.randomUUID(),
    extractResourceId: (payload) => {
      const p = payload as { repository?: { id: number | string }; installation?: { id: number | string } };
      if (p.repository?.id != null) return String(p.repository.id);
      if (p.installation?.id != null) return String(p.installation.id);
      return null;
    },
    parsePayload: (raw) => githubWebhookPayloadSchema.parse(raw),
  },

  oauth: {
    buildAuthUrl: (config, state) => {
      const url = new URL(`https://github.com/apps/${config.appSlug}/installations/new`);
      url.searchParams.set("state", state);
      return url.toString();
    },
    exchangeCode: async (config, code, redirectUri) => {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: redirectUri }),
      });
      if (!response.ok) throw new Error(`GitHub token exchange failed: ${response.status}`);
      const data = githubOAuthResponseSchema.parse(await response.json());
      if ("error" in data) throw new Error(`GitHub OAuth error: ${data.error_description}`);
      return { accessToken: data.access_token, scope: data.scope, tokenType: data.token_type, raw: data as Record<string, unknown> };
    },
    refreshToken: async () => { throw new Error("GitHub user tokens do not support refresh"); },
    revokeToken: async (config, accessToken) => {
      const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
      const response = await fetch(`https://api.github.com/applications/${config.clientId}/token`, {
        method: "DELETE",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
        body: JSON.stringify({ access_token: accessToken }),
      });
      if (!response.ok) throw new Error(`GitHub token revocation failed: ${response.status}`);
    },
    processCallback: async (config, query) => {
      const installationId = query.installation_id;
      const setupAction = query.setup_action;
      if (setupAction === "request") throw new Error("setup_action=request is not yet implemented");
      if (setupAction === "update") throw new Error("setup_action=update is not yet implemented");
      if (!installationId) throw new Error("missing installation_id");

      const details = await getInstallationDetails(config, installationId);
      return {
        externalId: installationId,
        accountInfo: {
          version: 1 as const,
          sourceType: "github" as const,
          events: details.events,
          installedAt: details.created_at,
          lastValidatedAt: new Date().toISOString(),
          raw: details,
        },
        setupAction,
      };
    },
  },

  capabilities: {
    createAppJWT: (config: GitHubConfig) => createGitHubAppJWT(config),
    getInstallationToken: (config: GitHubConfig, installationId: string) => getInstallationToken(config, installationId),
    getInstallationDetails: (config: GitHubConfig, installationId: string) => getInstallationDetails(config, installationId),
  },
});
```

### The Registry IS The Index

```ts
// index.ts — THE single entry point. Adding a provider = add 1 import + 1 entry.

import type { SourceType } from "@repo/console-validation";
import type { ProviderDefinition } from "./define";
import { github } from "./providers/github";
import { vercel } from "./providers/vercel";
import { linear } from "./providers/linear";
import { sentry } from "./providers/sentry";

// ── The Registry ──────────────────────────────────────────────────────────────

export const PROVIDERS = { github, vercel, linear, sentry } as const;

export type ProviderName = keyof typeof PROVIDERS;

// ── Derived Exports (zero manual maintenance) ─────────────────────────────────

export const PROVIDER_NAMES = Object.keys(PROVIDERS) as ProviderName[];

export function getProvider(name: string): ProviderDefinition | undefined {
  return PROVIDERS[name as ProviderName];
}

/** Backwards-compatible: provider metadata for UI */
export const PROVIDER_REGISTRY = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [
    key,
    { name: p.displayName, description: p.description, events: p.categories },
  ]),
) as Record<SourceType, { name: string; description: string; events: Record<string, { label: string; description: string; type: string }> }>;

export const EVENT_CATEGORIES = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [key, p.categories]),
) as Record<SourceType, Record<string, { label: string; description: string; type: string }>>;

export const WEBHOOK_EVENT_TYPES: Record<SourceType, string[]> = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [key, Object.keys(p.categories)]),
) as Record<SourceType, string[]>;

export function getEventWeight(source: SourceType, eventType: string): number {
  const provider = PROVIDERS[source as ProviderName];
  if (!provider) return 35;
  const eventDef = provider.events[eventType];
  return eventDef?.weight ?? 35;
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export { defineProvider, defineEvent } from "./define";
export type { ProviderDefinition, CategoryDef, EventDefinition, WebhookDef, OAuthDef } from "./define";
export type { OAuthTokens, CallbackResult, TransformContext, GitHubConfig, VercelConfig, LinearConfig, SentryConfig } from "./types";
export { githubConfigSchema, vercelConfigSchema, linearConfigSchema, sentryConfigSchema } from "./types";
export { transformWebhookPayload } from "./dispatch";
export { computeHmac, timingSafeEqual } from "./crypto";
```

### Generic Dispatch (Zero Casts)

```ts
// dispatch.ts

import type { PostTransformEvent, SourceType } from "@repo/console-validation";
import type { TransformContext } from "./types";
import { PROVIDERS, type ProviderName } from "./index";

/**
 * Central webhook payload transformer.
 * Routes (provider, eventType) to the appropriate transformer.
 * Returns null for unsupported event types.
 *
 * Zero `as` casts — the defineEvent() pattern ensures schema<->transform consistency.
 * Each event's schema.parse() narrows the payload before the transform runs.
 */
export function transformWebhookPayload(
  provider: SourceType,
  eventType: string,
  payload: unknown,
  context: TransformContext,
): PostTransformEvent | null {
  const providerDef = PROVIDERS[provider as ProviderName];
  if (!providerDef) return null;

  const category = providerDef.resolveCategory?.(eventType) ?? eventType;
  const eventDef = providerDef.events[category];
  if (!eventDef) return null;

  const parsed = eventDef.schema.parse(payload);
  return eventDef.transform(parsed, { ...context, eventType });
}
```

### What Happens to Service Routes

**Gateway `connections.ts`** — validates config once at startup, calls pure functions:
```ts
import { PROVIDERS } from "@repo/console-providers";
import type { ProviderName } from "@repo/console-providers";

// Validate config at startup — fail fast if env is misconfigured
const configs = {
  github: PROVIDERS.github.configSchema.parse({
    appSlug: env.GITHUB_APP_SLUG,
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
  }),
  vercel: PROVIDERS.vercel.configSchema.parse({ ... }),
  // Linear/Sentry: conditionally parsed based on env availability
  ...(env.LINEAR_CLIENT_ID ? { linear: PROVIDERS.linear.configSchema.parse({ ... }) } : {}),
  ...(env.SENTRY_APP_SLUG ? { sentry: PROVIDERS.sentry.configSchema.parse({ ... }) } : {}),
};

// GET /:provider/authorize — generic for all providers
connections.get("/:provider/authorize", async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const provider = PROVIDERS[providerName];
  const config = configs[providerName];
  if (!provider || !config) throw new HTTPException(400, { message: `Unknown provider: ${providerName}` });

  const url = provider.oauth.buildAuthUrl(config, state);
  return c.json({ url });
});

// GET /:provider/callback — generic for all providers
connections.get("/:provider/callback", async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const provider = PROVIDERS[providerName];
  const config = configs[providerName];

  // Pure function call — no Hono context passed to provider
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const result = await provider.oauth.processCallback(config, query);

  // DB operations stay HERE in the route
  const rows = await db.insert(gwInstallations).values({
    provider: providerName,
    externalId: result.externalId,
    orgId: stateData.orgId,
    connectedBy: stateData.connectedBy,
    status: "active",
    providerAccountInfo: result.accountInfo,
  }).onConflictDoUpdate({ ... }).returning();

  if (result.tokens) {
    await writeTokenRecord(rows[0].id, result.tokens);
  }
});

// GET /:id/token — resolveToken stays in gateway (DB + decrypt concern)
connections.get("/:id/token", async (c) => {
  const installation = /* fetch from DB */;
  const providerName = installation.provider as ProviderName;

  // GitHub: use capabilities to get installation token (pure fetch)
  if (providerName === "github") {
    const config = configs.github;
    const token = await PROVIDERS.github.capabilities.getInstallationToken(config, installation.externalId);
    return c.json({ accessToken: token, provider: "github", expiresIn: 3600 });
  }

  // Others: read from gwTokens + decrypt (infra concern, stays here)
  const tokenRow = await db.select().from(gwTokens).where(...);
  const decrypted = await decrypt(tokenRow.accessToken, encryptionKey);
  // ... handle refresh if expired
});
```

**Relay `webhooks.ts`** — same pattern:
```ts
import { PROVIDERS } from "@repo/console-providers";
import type { ProviderName } from "@repo/console-providers";

// Only webhook secrets needed for relay
const configs = {
  github: PROVIDERS.github.configSchema.parse({ webhookSecret: env.GITHUB_WEBHOOK_SECRET, ... }),
  vercel: PROVIDERS.vercel.configSchema.parse({ ... }),
  linear: PROVIDERS.linear.configSchema.parse({ ... }),
  sentry: PROVIDERS.sentry.configSchema.parse({ ... }),
};

webhooks.post("/:provider", async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const provider = PROVIDERS[providerName];
  const config = configs[providerName];
  if (!provider || !config) return c.json({ error: "unknown_provider" }, 400);

  const rawBody = await c.req.text();
  const secret = provider.webhook.extractSecret(config);
  const valid = await provider.webhook.verifySignature(rawBody, c.req.raw.headers, secret);
  if (!valid) return c.json({ error: "invalid_signature" }, 401);

  const payload = provider.webhook.parsePayload(JSON.parse(rawBody));
  const deliveryId = provider.webhook.extractDeliveryId(c.req.raw.headers, payload);
  const eventType = provider.webhook.extractEventType(c.req.raw.headers, payload);
  const resourceId = provider.webhook.extractResourceId(payload);
  // ... dispatch to QStash/workflow
});
```

**Console ingress** — unchanged API:
```ts
import { transformWebhookPayload } from "@repo/console-providers";

export function transformEnvelope(envelope: WebhookEnvelope): PostTransformEvent | null {
  return transformWebhookPayload(envelope.provider, envelope.eventType, envelope.payload, {
    deliveryId: envelope.deliveryId,
    receivedAt: new Date(envelope.receivedAt),
    eventType: envelope.eventType,
  });
}
```

### Deps Summary

```
                    What                                         Where
 Provider definitions (metadata, schemas, OAuth, webhook)    @repo/console-providers
 Zod schemas (webhook + OAuth response)                      @repo/console-providers
 Transformers, sanitization, validation                      @repo/console-providers
 Crypto (HMAC, JWT signing)                                  @repo/console-providers
 DB operations, Redis, token encryption                      Services (gateway/relay routes)
 Env resolution, Hono routing                                Services
 Config validation + injection                               Services (one-liner per provider at startup)
```

Package deps: `zod`, `@repo/console-validation`. Uses `fetch` + `crypto.subtle` (web platform APIs). Zero vendor/infra packages.

---

## Phase 1: Create Package + Core Infrastructure

### Overview
Bootstrap `@repo/console-providers` with the `defineProvider()` system, crypto utilities, JWT signing, Zod schemas, transformer functions, and all 4 provider definitions. The dispatch function. No consumers updated yet.

### Changes Required:

#### 1. Package scaffolding
Create `packages/console-providers/` with package.json, tsconfig.json, tsup.config.ts. Follow existing package conventions (copy from `console-webhooks`).

#### 2. Core files
- `src/define.ts` — `defineProvider()`, `defineEvent()`, `ProviderDefinition`, `EventDefinition`, `CategoryDef`, `WebhookDef`, `OAuthDef`
- `src/types.ts` — Zod schemas for `OAuthTokens`, `CallbackResult`, config schemas (`githubConfigSchema`, etc.), `TransformContext`, `SentryInstallationToken` encoding
- `src/crypto.ts` — `computeHmac(message, secret, algorithm)`, `computeHmacSha1()`, `timingSafeEqual()` — moved from `relay/src/lib/crypto.ts`
- `src/jwt.ts` — `createRS256JWT(payload, privateKeyPem)`, `importPKCS8Key(rawKey)` — extracted from `gateway/src/lib/github-jwt.ts`, parameterized (no env reads)
- `src/sanitize.ts` — Moved from `console-webhooks/src/sanitize.ts`
- `src/validation.ts` — Moved from `console-webhooks/src/post-transformers/validation.ts`

#### 3. Zod schemas (move, no logic changes)
- `src/schemas/github.ts` <- `console-webhooks/src/pre-transformers/schemas/github.ts` + relay's loose schema merged
- `src/schemas/linear.ts` <- same pattern
- `src/schemas/vercel.ts` <- same pattern
- `src/schemas/sentry.ts` <- same pattern

Each schema file exports both the detailed pre-transform schemas (for dispatch) AND the loose webhook payload schema (for relay-side parsing).

#### 4. Transformer functions (move, update imports only)
- `src/transformers/github.ts` <- `console-webhooks/src/pre-transformers/github.ts`
- `src/transformers/vercel.ts` <- same pattern
- `src/transformers/linear.ts` <- same pattern
- `src/transformers/sentry.ts` <- same pattern

Also move OAuth response schemas from `apps/gateway/src/providers/schemas.ts` into each provider file.

#### 5. Provider definitions (NEW — the core of this refactor)
- `src/providers/github.ts` — `defineProvider({ name: "github", ... })` with all OAuth, webhook, capabilities
- `src/providers/vercel.ts` — `defineProvider({ name: "vercel", ... })`
- `src/providers/linear.ts` — `defineProvider({ name: "linear", ... })` with `fetchLinearContext` in capabilities
- `src/providers/sentry.ts` — `defineProvider({ name: "sentry", ... })` with Sentry token encoding

Provider-specific notes:
- **GitHub**: `capabilities.createAppJWT`, `capabilities.getInstallationToken`, `capabilities.getInstallationDetails` — all take config as first arg
- **Vercel**: `processCallback` extracts `code` and `configurationId`, calls `exchangeCode`, cross-validates `installation_id`, returns `externalId = team_id ?? user_id`
- **Linear**: `processCallback` calls `exchangeCode` then `fetchLinearContext(accessToken)` (GraphQL query for org info), returns `externalId = org.id ?? viewer.id`
- **Sentry**: `processCallback` encodes `installationId:code` composite before calling `exchangeCode`, returns `externalId = sentryInstallationId`
- **Vercel webhook**: Uses HMAC-SHA1 (not SHA-256) — `computeHmac(rawBody, secret, "SHA-1")`
- **Linear webhook**: `extractDeliveryId` falls back to `stableFingerprint(payload)` — move the FNV-1a hash into the provider file
- **Sentry webhook**: `extractDeliveryId` concatenates `sentry-hook-resource:sentry-hook-timestamp` headers

#### 6. Dispatch function
- `src/dispatch.ts` — `transformWebhookPayload()` — generic, zero casts, uses `provider.events[category].schema.parse(payload)` before calling `transform`

#### 7. Registry + public API
- `src/index.ts` — `PROVIDERS`, `getProvider()`, `PROVIDER_REGISTRY`, `EVENT_CATEGORIES`, `WEBHOOK_EVENT_TYPES`, `getEventWeight()`, re-exports

### Success Criteria:

#### Automated Verification:
- [x] Package builds: `pnpm --filter @repo/console-providers build`
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Each provider is a single `defineProvider()` call with all concerns unified
- [ ] `transformWebhookPayload()` has zero `as` casts
- [ ] Config schemas validate correctly (try parsing invalid config — should throw)
- [ ] `PROVIDER_REGISTRY` derived output matches existing shape from `console-types/src/provider.ts`

**Implementation Note**: Phase 1 creates the new package in parallel — old packages still exist and work. Pause for confirmation before proceeding.

---

## Phase 2: Migrate Gateway Service

### Overview
Replace `apps/gateway/src/providers/` with imports from `@repo/console-providers`. Split `handleCallback` into pure `processCallback` (in provider) + DB operations (in route). Delete gateway provider impls.

### Changes Required:

#### 1. Update gateway routes
- `apps/gateway/src/routes/connections.ts`:
  - Import `PROVIDERS` from `@repo/console-providers`
  - Create `configs` object at module level by parsing env through each provider's `configSchema`
  - Replace `getProvider(name).getAuthorizationUrl(state)` with `PROVIDERS[name].oauth.buildAuthUrl(configs[name], state)`
  - Replace `provider.handleCallback(c, stateData)` with:
    1. `provider.oauth.processCallback(config, queryParams)` — pure, returns `CallbackResult`
    2. DB upsert into `gwInstallations` using the result — stays in route
    3. `writeTokenRecord()` if `result.tokens` — stays in route
  - Replace `provider.resolveToken(installation)` with:
    - GitHub: `PROVIDERS.github.capabilities.getInstallationToken(config, externalId)` — pure fetch
    - Others: keep DB read + decrypt logic in the route (infra concern)

#### 2. Delete `apps/gateway/src/lib/github-jwt.ts`
Logic moved to `@repo/console-providers/jwt.ts` (parameterized) + `GitHubProvider.capabilities`.

#### 3. Delete gateway provider files
- Delete `apps/gateway/src/providers/impl/github.ts`
- Delete `apps/gateway/src/providers/impl/vercel.ts`
- Delete `apps/gateway/src/providers/impl/linear.ts`
- Delete `apps/gateway/src/providers/impl/sentry.ts`
- Delete `apps/gateway/src/providers/types.ts`
- Delete `apps/gateway/src/providers/schemas.ts`
- Delete `apps/gateway/src/providers/index.ts`

Keep test files — update them to test provider definitions from `@repo/console-providers`.

#### 4. Update gateway package.json
- Add `@repo/console-providers` dep
- Remove any `@repo/console-webhooks` dep if present

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [ ] `pnpm build:gateway` succeeds
- [x] Gateway tests pass: `pnpm --filter gateway test`

#### Manual Verification:
- [ ] `apps/gateway/src/providers/impl/` directory no longer exists
- [ ] `apps/gateway/src/lib/github-jwt.ts` no longer exists
- [ ] Gateway routes are generic (no provider-specific switch cases in authorize/callback)
- [ ] OAuth flows work end-to-end for at least one provider

**Implementation Note**: Pause for manual OAuth flow testing before proceeding.

---

## Phase 3: Migrate Relay Service

### Overview
Replace `apps/relay/src/providers/` with imports from `@repo/console-providers`. Delete relay provider impls and loose schemas.

### Changes Required:

#### 1. Update relay webhook route
- `apps/relay/src/routes/webhooks.ts`:
  - Import `PROVIDERS` from `@repo/console-providers`
  - Create `configs` by parsing env through each provider's `configSchema`
  - Replace `provider.getWebhookSecret(env)` with `provider.webhook.extractSecret(config)`
  - Replace `provider.verifyWebhook(rawBody, headers, secret)` with `provider.webhook.verifySignature(rawBody, headers, secret)`
  - Replace `provider.parsePayload(JSON.parse(rawBody))` with `provider.webhook.parsePayload(JSON.parse(rawBody))`
  - Replace `provider.extractEventType/DeliveryId/ResourceId` with `provider.webhook.extract*`

#### 2. Delete relay `lib/crypto.ts`
Logic moved to `@repo/console-providers/crypto.ts`.

#### 3. Delete relay provider files
- Delete `apps/relay/src/providers/impl/github.ts`
- Delete `apps/relay/src/providers/impl/vercel.ts`
- Delete `apps/relay/src/providers/impl/linear.ts`
- Delete `apps/relay/src/providers/impl/sentry.ts`
- Delete `apps/relay/src/providers/schemas.ts` (loose schemas)
- Delete `apps/relay/src/providers/types.ts`
- Delete `apps/relay/src/providers/index.ts`

Keep test files — update them to test provider definitions from `@repo/console-providers`.

#### 4. Update relay package.json
- Add `@repo/console-providers` dep
- Remove `@repo/console-webhooks` dep if present

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [ ] `pnpm build:relay` succeeds
- [x] Relay tests pass: `pnpm --filter relay test`

#### Manual Verification:
- [ ] `apps/relay/src/providers/impl/` directory no longer exists
- [ ] `apps/relay/src/providers/schemas.ts` no longer exists
- [ ] Webhook verification works for at least one provider

**Implementation Note**: Pause for manual webhook testing before proceeding.

---

## Phase 4: Delete Old Packages + Update All Consumers

### Overview
Delete `@repo/console-webhooks` and `console-types/src/provider.ts`. Update all remaining consumers to import from `@repo/console-providers`.

### Changes Required:

#### 1. Update console ingress
- `apps/console/src/app/api/gateway/ingress/_lib/transform.ts` -> import `transformWebhookPayload` from `@repo/console-providers`

#### 2. Update console UI consumers
- `apps/console/src/lib/provider-config.ts` -> import `PROVIDER_REGISTRY` from `@repo/console-providers`
- `apps/console/src/components/debug-panel-content.tsx` -> update imports
- `apps/console/src/app/api/debug/inject-event/` -> update imports
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/source-settings-form.tsx` -> update imports
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-row.tsx` -> update imports

#### 3. Update API console
- `api/console/src/inngest/workflow/neural/scoring.ts` -> import `getEventWeight` from `@repo/console-providers`

#### 4. Update console-backfill
- `packages/console-backfill/src/adapters/round-trip.test.ts` -> update imports
- `packages/console-backfill/src/adapters/vercel.ts` -> update imports
- `packages/console-backfill/src/adapters/github.ts` -> update imports

#### 5. Update console-test-data
- `packages/console-test-data/src/loader/transform.ts` -> update imports
- `packages/console-test-data/src/cli/verify-event-filtering.ts` -> update imports (currently imports from `@repo/console-types/provider`)
- `packages/console-test-data/src/cli/verify-datasets.ts` -> update imports
- `packages/console-test-data/src/cli/generate-schema.ts` -> update imports

#### 6. Update `@repo/console-types`
- Delete `src/provider.ts`
- In `src/index.ts`: re-export `PROVIDER_REGISTRY`, `EVENT_REGISTRY`, `EVENT_CATEGORIES`, `getEventWeight`, etc. from `@repo/console-providers` for backwards compatibility during transition
- Add `@repo/console-providers` as a dependency
- Remove `@repo/console-webhooks` from dependencies

#### 7. Delete `@repo/console-webhooks`
- Remove `packages/console-webhooks/` entirely
- Remove from all package.json deps:
  - `apps/console/package.json`
  - `packages/console-types/package.json`
  - `packages/console-test-data/package.json`
  - `packages/console-backfill/package.json`
  - `api/console/package.json`
- Remove from pnpm-workspace.yaml if listed
- Remove from `.changeset/pre.json` if listed

### Success Criteria:

#### Automated Verification:
- [ ] No references to `@repo/console-webhooks` remain: `grep -r "console-webhooks" --include="*.ts" --include="*.json" | grep -v node_modules | grep -v .changeset`
- [ ] `pnpm install` succeeds
- [ ] `pnpm typecheck` passes across all packages
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm build:relay` succeeds
- [ ] `pnpm build:gateway` succeeds

#### Manual Verification:
- [ ] `packages/console-webhooks/` no longer exists
- [ ] `packages/console-types/src/provider.ts` no longer exists
- [ ] Debug panel shows event registry correctly
- [ ] Full webhook flow works: relay -> QStash -> console ingress -> transform -> store

---

## Phase 5: Clean Up EVENT_REGISTRY + Compile-Time Assertions

### Overview
The existing `EVENT_REGISTRY` in `console-types/src/provider.ts` has 50+ entries with compile-time assertions. Once `console-providers` is the source of truth, re-derive these from the provider definitions or remove the duplication.

### Changes Required:

#### 1. Derive EVENT_REGISTRY from PROVIDERS
The current EVENT_REGISTRY maps fine-grained event keys like `"github:pull-request.opened"` to weights. The new provider definitions have coarser events (category-level). Two options:

**Option A**: Keep EVENT_REGISTRY as-is in `console-providers/src/event-registry.ts`, imported by consumers that need per-action weights (scoring). Remove the manual compile-time assertions — they're now redundant since `defineProvider()` enforces consistency.

**Option B**: Extend `defineEvent()` to include per-action sub-events with individual weights. More complete but larger refactor.

**Decision**: Option A for this plan. EVENT_REGISTRY stays as a derived/maintained lookup. Compile-time assertions are replaced by runtime validation in `defineProvider()`.

#### 2. Remove `@repo/console-types` re-exports
Once all consumers import directly from `@repo/console-providers`, remove the re-exports added in Phase 4 step 6.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes

#### Manual Verification:
- [ ] `getEventWeight()` returns correct values for all event types
- [ ] No circular dependency between `console-types` and `console-providers`

---

## Testing Strategy

### Unit Tests (in `@repo/console-providers`):
- Each provider's `webhook.verifySignature()` with known test vectors
- Each provider's `webhook.extractEventType/DeliveryId/ResourceId` with real header/payload fixtures
- Each provider's `oauth.exchangeCode/refreshToken/revokeToken` with mocked fetch
- Each provider's `oauth.processCallback` with mocked fetch
- `transformWebhookPayload()`: known events -> correct PostTransformEvent, unknown events -> null
- `computeHmac()` with known HMAC test vectors for SHA-256 and SHA-1
- `createRS256JWT()` produces valid JWTs (verify with known public key)
- Config schema validation: valid config passes, invalid config throws
- `stableFingerprint()` determinism test (Linear)
- `encodeSentryToken()`/`decodeSentryToken()` round-trip

### Integration Tests:
- Existing transformer tests from `console-webhooks` moved to `console-providers`
- Existing relay provider tests updated to test new provider definitions
- Existing gateway provider tests updated to test new provider definitions

### Manual Testing Steps:
1. OAuth flow: connect a GitHub installation (uses JWT + installation token)
2. OAuth flow: connect a Vercel integration (uses code exchange + token storage)
3. Webhook flow: send a real GitHub webhook, verify HMAC + transformation
4. Debug panel: verify event metadata displays correctly
5. Scoring: verify `getEventWeight()` returns correct values

## Performance Considerations

- Provider definitions are frozen const objects — zero instantiation cost
- `transformWebhookPayload()` does `schema.parse()` + `transform` in one call (no double-parse)
- Config schemas are parsed once at service startup (fail fast)
- Derived exports (`PROVIDER_REGISTRY`, `WEBHOOK_EVENT_TYPES`, etc.) computed once at module load

## Key Design Decisions

1. **Const objects over classes**: No `this`, no constructor, no instance state. Every function is testable in isolation with explicit inputs.

2. **Config as first arg over env reads**: Provider functions never read `process.env` or Hono env. Config is validated once at startup via Zod schema and passed explicitly. This makes providers pure and testable.

3. **`processCallback` split from `handleCallback`**: The provider's `processCallback` does the pure work (extract query params, call provider APIs, return result). The route handler does DB upserts and token storage. Clean separation of provider logic from infra.

4. **No Zod `z.registry()`**: It's schema-identity-keyed (WeakMap semantics) with no iteration or string lookup. A simple `const PROVIDERS = { ... }` is the right abstraction for a provider registry.

5. **No `jose` dependency**: The existing `github-jwt.ts` already uses Web Crypto API directly. Just parameterize it (remove env reads) and move to `jwt.ts`.

6. **Relay and gateway share the same provider definition**: No more `WebhookProvider` vs `ConnectionProvider` split. One definition has both `.webhook` and `.oauth` — each service uses what it needs.

7. **Conditional provider availability**: Gateway currently checks `process.env` for Linear/Sentry at module load. With Zod config schemas, this becomes: try to parse config, if it fails (missing env), don't include that provider in the `configs` map.

## References

- Current provider.ts: `packages/console-types/src/provider.ts`
- Current dispatch: `packages/console-webhooks/src/dispatch.ts`
- Current schemas: `packages/console-webhooks/src/pre-transformers/schemas/`
- Current transformers: `packages/console-webhooks/src/pre-transformers/`
- Relay providers: `apps/relay/src/providers/`
- Gateway providers: `apps/gateway/src/providers/`
- GitHub JWT (Web Crypto): `apps/gateway/src/lib/github-jwt.ts`
- Relay crypto: `apps/relay/src/lib/crypto.ts`
- Gateway OAuth schemas: `apps/gateway/src/providers/schemas.ts`
- Console ingress transform: `apps/console/src/app/api/gateway/ingress/_lib/transform.ts`
- Console provider config: `apps/console/src/lib/provider-config.ts`

### Consumer files requiring import updates (Phase 4):
- `apps/console/src/app/api/gateway/ingress/_lib/transform.ts` — `@repo/console-webhooks`
- `apps/console/src/app/api/gateway/ingress/route.ts` — `@repo/console-webhooks`
- `apps/console/src/lib/provider-config.ts` — `@repo/console-types` (PROVIDER_REGISTRY)
- `apps/console/src/components/debug-panel-content.tsx` — PROVIDER_REGISTRY/EVENT_REGISTRY
- `apps/console/src/app/api/debug/inject-event/route.ts` — EVENT_REGISTRY/WEBHOOK_EVENT_TYPES
- `apps/console/src/app/api/debug/inject-event/_lib/schemas.ts` — `@repo/console-webhooks`
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/source-settings-form.tsx` — PROVIDER_REGISTRY
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/events/_components/event-row.tsx` — getEventWeight
- `api/console/src/inngest/workflow/neural/scoring.ts` — getEventWeight
- `packages/console-test-data/src/loader/transform.ts` — `@repo/console-webhooks`
- `packages/console-test-data/src/cli/verify-event-filtering.ts` — `@repo/console-types/provider`
- `packages/console-test-data/src/cli/verify-datasets.ts` — PROVIDER_REGISTRY
- `packages/console-test-data/src/cli/generate-schema.ts` — EVENT_REGISTRY
- `packages/console-backfill/src/adapters/round-trip.test.ts` — `@repo/console-webhooks`
- `packages/console-backfill/src/adapters/vercel.ts` — `@repo/console-webhooks`
- `packages/console-backfill/src/adapters/github.ts` — `@repo/console-webhooks`
