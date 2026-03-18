import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { computeHmac, timingSafeEqual } from "./crypto";
import type { ProviderDisplayEntry } from "./display";
import type { PostTransformEvent } from "./post-transform-event";
import type {
  BaseProviderAccountInfo,
  CallbackResult,
  EdgeRule,
  OAuthTokens,
  TransformContext,
} from "./types";

// ── Provider Kind + Auth Kind (Zod enums — anchor discriminant literals) ─────
// Factories use `satisfies z.infer<typeof providerKindSchema>` so adding or
// removing a kind from this enum causes a compile-time error in the factory.

export const providerKindSchema = z.enum(["webhook", "managed", "api"]);
export type ProviderKind = z.infer<typeof providerKindSchema>;

export const authKindSchema = z.enum(["oauth", "api-key", "app-token"]);
export type AuthKind = z.infer<typeof authKindSchema>;

export const categoryDefSchema = z.object({
  description: z.string(),
  label: z.string(),
  type: z.enum(["observation", "sync+observation"]),
});
export type CategoryDef = z.infer<typeof categoryDefSchema>;

/** Per-action sub-event definition (e.g., "opened", "merged" for pull_request) */
export const actionDefSchema = z.object({
  label: z.string(),
  weight: z.number(),
});
export type ActionDef = z.infer<typeof actionDefSchema>;

/** Simple event — no sub-actions */
export interface SimpleEventDef<S extends z.ZodType = z.ZodType> {
  readonly kind: "simple";
  readonly label: string;
  readonly schema: S;
  readonly transform: (
    payload: z.infer<S>,
    ctx: TransformContext,
    eventType: string
  ) => PostTransformEvent;
  readonly weight: number;
}

/** Event with sub-actions (e.g., PR opened/closed/merged) */
export interface ActionEventDef<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> = Record<string, ActionDef>,
> {
  readonly actions: TActions;
  readonly kind: "with-actions";
  readonly label: string;
  readonly schema: S;
  readonly transform: (
    payload: z.infer<S>,
    ctx: TransformContext,
    eventType: string
  ) => PostTransformEvent;
  readonly weight: number;
}

/** Discriminated union — switches on `kind` */
export type EventDefinition<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> = Record<string, ActionDef>,
> = SimpleEventDef<S> | ActionEventDef<S, TActions>;

/** Factory: simple event (no sub-actions) */
export function simpleEvent<S extends z.ZodType>(
  def: Omit<SimpleEventDef<S>, "kind">
): SimpleEventDef<S> {
  return { kind: "simple", ...def };
}

/** Factory: event with sub-actions */
export function actionEvent<
  S extends z.ZodType,
  const TActions extends Record<string, ActionDef>,
>(def: Omit<ActionEventDef<S, TActions>, "kind">): ActionEventDef<S, TActions> {
  return { kind: "with-actions", ...def };
}

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

type VerifyFn = (rawBody: string, headers: Headers, secret: string) => boolean;

// Exhaustive algorithm map. `satisfies Record<HmacScheme["algorithm"], ...>` causes
// a TypeScript error when a new algorithm is added to the enum but not yet added
// here — no silent fallthrough to a wrong algorithm.
const HMAC_ALGO_MAP = {
  sha256: "SHA-256",
  sha1: "SHA-1",
} as const satisfies Record<HmacScheme["algorithm"], "SHA-256" | "SHA-1">;

function _deriveHmacVerify(scheme: HmacScheme): VerifyFn {
  return (rawBody, headers, secret) => {
    const rawSig = headers.get(scheme.signatureHeader);
    if (!rawSig) {
      return false;
    }
    const received = scheme.prefix
      ? rawSig.slice(scheme.prefix.length)
      : rawSig;
    const expected = computeHmac(
      rawBody,
      secret,
      HMAC_ALGO_MAP[scheme.algorithm]
    );
    return timingSafeEqual(received, expected);
  };
}

// Exhaustive switch — TypeScript errors if a new `kind` is added to
// signatureSchemeSchema without a corresponding case here.
export function deriveVerifySignature(scheme: SignatureScheme): VerifyFn {
  switch (scheme.kind) {
    case "hmac":
      return _deriveHmacVerify(scheme);
  }
}

/** Webhook extraction functions — pure, no env/DB/framework */
export interface WebhookDef<TConfig> {
  extractDeliveryId: (headers: Headers, payload: unknown) => string;
  extractEventType: (headers: Headers, payload: unknown) => string;
  extractResourceId: (payload: unknown) => string | null;
  extractSecret: (config: TConfig) => string;
  /** Zod schema for required webhook headers — validated before body read.
   *  Keys are lowercase header names. Used by relay middleware for early rejection.
   *  Must be a z.object() with string-valued fields (required or optional). */
  readonly headersSchema: z.ZodObject<
    Record<string, z.ZodType<string | undefined>>
  >;
  parsePayload: (raw: unknown) => unknown;
  /** Zod-first signature scheme — relay derives verifySignature from this automatically. */
  readonly signatureScheme: SignatureScheme;
  /** Optional override — only needed when scheme is non-standard.
   *  When absent, relay derives from signatureScheme via deriveVerifySignature(). */
  readonly verifySignature?: (
    rawBody: string,
    headers: Headers,
    secret: string
  ) => boolean;
}

// ── Managed Webhook Types ────────────────────────────────────────────────────

export const webhookSetupStateSchema = z.object({
  endpointId: z.string(),
  signingSecret: z.string(),
});
export type WebhookSetupState = z.infer<typeof webhookSetupStateSchema>;

/**
 * Programmatic webhook lifecycle management for managed providers (HubSpot, Stripe).
 * `register` creates the webhook endpoint on the provider; `unregister` removes it.
 * Returns `TState` (at minimum `endpointId` + `signingSecret`) to store in the DB.
 */
export interface WebhookSetupDef<
  TConfig,
  TState extends WebhookSetupState = WebhookSetupState,
> {
  readonly defaultEvents: readonly string[];
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
}

/**
 * Combined inbound webhook definition for managed providers.
 * `webhook` handles verification and extraction; `setup` handles registration.
 */
export interface ManagedWebhookDef<
  TConfig,
  TState extends WebhookSetupState = WebhookSetupState,
> {
  readonly setup: WebhookSetupDef<TConfig, TState>;
  readonly webhook: WebhookDef<TConfig>;
}

/** OAuth functions — pure fetch, no env/DB/framework */
export interface OAuthDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> {
  readonly buildAuthUrl: (
    config: TConfig,
    state: string,
    options?: Record<string, unknown>
  ) => string;
  readonly exchangeCode: (
    config: TConfig,
    code: string,
    redirectUri: string
  ) => Promise<OAuthTokens>;
  /** Get a usable bearer token — returns the stored access token directly. */
  readonly getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  readonly kind: "oauth";
  /** Extract params from callback query string, call provider APIs, return result. No DB, no Hono. */
  readonly processCallback: (
    config: TConfig,
    query: Record<string, string>
  ) => Promise<CallbackResult<TAccountInfo>>;
  readonly refreshToken: (
    config: TConfig,
    refreshToken: string
  ) => Promise<OAuthTokens>;
  readonly revokeToken: (config: TConfig, accessToken: string) => Promise<void>;
  /** OAuth tokens are always persisted — the stored token IS the active credential. */
  readonly usesStoredToken: true;
}

/** API-key auth — user pastes key, stored encrypted in token vault as accessToken */
export interface ApiKeyDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> {
  /** Build the Authorization header value from the stored key */
  readonly buildAuthHeader: (apiKey: string) => string;
  /** Get the active credential — for API-key providers, returns storedAccessToken (the key itself) */
  readonly getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  readonly kind: "api-key";
  /**
   * Process connection setup: receive key from UI, validate, return CallbackResult to store.
   * Analogous to processCallback for OAuth providers.
   */
  readonly processSetup: (
    config: TConfig,
    params: { apiKey: string }
  ) => Promise<CallbackResult<TAccountInfo>>;
  /** API keys don't refresh */
  readonly refreshToken?: never;
  readonly revokeToken?: (config: TConfig, apiKey: string) => Promise<void>;
  /** API keys are always stored */
  readonly usesStoredToken: true;
  /** Optional: validate key against provider API on connection setup */
  readonly validateKey?: (config: TConfig, apiKey: string) => Promise<boolean>;
}

/**
 * App-token auth — provider uses app-level credentials (private key, app ID)
 * to generate per-installation tokens on demand. No token is stored.
 * Examples: GitHub App (RS256 JWT → installation access token).
 */
export interface AppTokenDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> {
  readonly buildAuthHeader?: (token: string) => string;
  readonly buildInstallUrl: (
    config: TConfig,
    state: string,
    options?: Record<string, unknown>
  ) => string;
  /** Generate a per-installation access token on demand (never reads storedAccessToken). */
  readonly getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  /** Generate an app-level JWT (e.g. GitHub RS256 JWT for app-level API calls). */
  readonly getAppToken?: (config: TConfig) => Promise<string>;
  readonly kind: "app-token";
  readonly processCallback: (
    config: TConfig,
    query: Record<string, string>
  ) => Promise<CallbackResult<TAccountInfo>>;
  readonly revokeAccess?: (
    config: TConfig,
    externalId: string
  ) => Promise<void>;
  /** App-token providers never store tokens — installations use on-demand generation. */
  readonly usesStoredToken: false;
}

export function isAppTokenAuth<TConfig>(
  auth: AuthDef<TConfig>
): auth is AppTokenDef<TConfig> {
  return auth.kind === "app-token";
}

/** Discriminated union of all auth strategies */
export type AuthDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> =
  | OAuthDef<TConfig, TAccountInfo>
  | ApiKeyDef<TConfig, TAccountInfo>
  | AppTokenDef<TConfig, TAccountInfo>;

// ── Connection Health ────────────────────────────────────────────────────────

export const connectionStatusSchema = z.enum([
  "healthy",
  "revoked",
  "suspended",
]);
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

/** Runtime values not sourced from env (e.g. callbackBaseUrl) */
export const runtimeConfigSchema = z.object({
  callbackBaseUrl: z.string(),
});
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

// ── API Surface schemas ─────────────────────────────────────────────────────────

export const rateLimitSchema = z.object({
  remaining: z.number(),
  resetAt: z.date(),
  limit: z.number(),
});

export type RateLimit = z.infer<typeof rateLimitSchema>;

// ── Proxy Wire Types ──────────────────────────────────────────────────────────
// Colocated here because ResourcePickerExecuteApiFn (below) uses ProxyExecuteResponse
// as its return type — the call-site types are provider-level concerns.

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

// ── Backfill schemas ────────────────────────────────────────────────────────────

// ── Backfill Depth ────────────────────────────────────────────────────────────
// Primitive of BackfillDef — defines how many days back a provider can backfill.

export const backfillDepthSchema = z.union([
  z.literal(1),
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);
export type BackfillDepth = z.infer<typeof backfillDepthSchema>;

/** Ordered options for UI depth selectors. */
export const BACKFILL_DEPTH_OPTIONS = [
  1, 7, 30, 90,
] as const satisfies readonly z.infer<typeof backfillDepthSchema>[];

export const backfillWebhookEventSchema = z.object({
  /** Unique per event: "backfill-{installationId}-{entityType}-{itemId}" */
  deliveryId: z.string(),
  /** Provider-specific event type, e.g. "pull_request", "issues", "deployment.succeeded" */
  eventType: z.string(),
  /** Webhook-shaped payload from adapter — matches PreTransform* schemas */
  payload: z.unknown(),
});

export type BackfillWebhookEvent = z.infer<typeof backfillWebhookEventSchema>;

export const backfillContextSchema = z.object({
  /** Gateway installation ID */
  installationId: z.string(),
  /** Single resource for this work unit */
  resource: z.object({
    providerResourceId: z.string(),
    resourceName: z.string(),
  }),
  /** ISO timestamp = now - depth days */
  since: z.string(),
});

export type BackfillContext = z.infer<typeof backfillContextSchema>;

// ── API Surface interfaces (contain functions — cannot be Zod) ──────────────────

export interface ApiEndpoint {
  /**
   * Optional auth override for this endpoint.
   * When present, the gateway calls this instead of the default oauth.getActiveToken flow.
   * Receives the provider config (typed as unknown — gateway erases generics).
   * Use for endpoints that require different credentials than the per-installation token
   * (e.g. GitHub App JWT for app-level endpoints, basic auth, API key, etc.).
   */
  readonly buildAuth?: (config: unknown) => Promise<string>;
  /** Human-readable description */
  readonly description: string;
  /** HTTP method */
  readonly method: "GET" | "POST";
  /** URL path template with {param} placeholders. Example: "/repos/{owner}/{repo}/pulls" */
  readonly path: string;
  /** Zod schema for the response body. Uses .passthrough() to allow extra fields. */
  readonly responseSchema: z.ZodType;
  /** Request timeout in ms. Default: 30_000 */
  readonly timeout?: number;
}

export interface ProviderApi {
  /** Base URL for the provider's API. Example: "https://api.github.com" */
  readonly baseUrl: string;
  /** Build the Authorization header value from the active token.
   *  Default behavior (when omitted): `Bearer ${token}`. */
  readonly buildAuthHeader?: (token: string) => string;
  /** Default headers for all API calls. */
  readonly defaultHeaders?: Record<string, string>;
  /** Available API endpoints, keyed by a stable identifier */
  readonly endpoints: Record<string, ApiEndpoint>;
  /** Parse rate-limit info from response headers. Return null if not parseable.
   *  This is an API-level concern — consumed by callers, never by gateway. */
  readonly parseRateLimit: (headers: Headers) => RateLimit | null;
}

// ── Backfill interfaces (contain functions — cannot be Zod) ─────────────────────

/** How to backfill a single entity type using a provider API endpoint */
export interface BackfillEntityHandler {
  /** Build the request parameters for the gateway proxy.
   *  Called once per page. `cursor` is null for the first page. */
  buildRequest(
    ctx: BackfillContext,
    cursor: unknown
  ): {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  /** Which API endpoint to use from the provider's api.endpoints catalog */
  readonly endpointId: string;
  /** Process the raw API response into webhook events + next cursor.
   *  `responseHeaders` is provided for providers that need
   *  header-based pagination (e.g., Sentry's Link header cursors). */
  processResponse(
    data: unknown,
    ctx: BackfillContext,
    cursor: unknown,
    responseHeaders?: Record<string, string>
  ): {
    events: BackfillWebhookEvent[];
    nextCursor: unknown | null;
    rawCount: number;
  };
}

/** Type-safe factory that narrows cursor type within a handler implementation,
 *  then erases to BackfillEntityHandler for the heterogeneous entityTypes record.
 *
 *  Usage:
 *    issue: typedEntityHandler<string>({ endpointId: "...", buildRequest(ctx, cursor) { ... }, processResponse(data, ctx, cursor) { ... } })
 *    pull_request: typedEntityHandler<{ page: number }>({ ... })
 */
export function typedEntityHandler<TCursor>(handler: {
  endpointId: string;
  buildRequest(
    ctx: BackfillContext,
    cursor: TCursor | null
  ): {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  processResponse(
    data: unknown,
    ctx: BackfillContext,
    cursor: TCursor | null,
    responseHeaders?: Record<string, string>
  ): {
    events: BackfillWebhookEvent[];
    nextCursor: TCursor | null;
    rawCount: number;
  };
}): BackfillEntityHandler {
  return handler as BackfillEntityHandler;
}

/** Backfill definition — required on every ProviderDefinition */
export interface BackfillDef {
  readonly defaultEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
  readonly supportedEntityTypes: readonly string[];
}

// ── Resource Picker Types (server-side normalization for sources/new UI) ─────

/** Callback signature for gateway proxy calls inside resourcePicker functions.
 *  The generic tRPC procedure binds the installationId and passes this to the provider. */
export type ResourcePickerExecuteApiFn = (request: {
  endpointId: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
}) => Promise<ProxyExecuteResponse>;

export interface NormalizedInstallation {
  readonly avatarUrl?: string | null;
  readonly externalId: string;
  readonly id: string;
  readonly label: string;
}

export interface NormalizedResource {
  readonly badge?: string | null;
  readonly iconColor?: string | null;
  readonly iconLabel?: string | null;
  readonly id: string;
  /** Resource name used when linking via bulkLinkResources.
   *  Falls back to `name` when absent. Sentry uses "orgSlug/projectSlug". */
  readonly linkName?: string;
  readonly name: string;
  readonly subtitle?: string | null;
}

export type InstallationMode = "multi" | "merged" | "single";

export interface ResourcePickerDef {
  /** Enrich a gateway installation with display data from the provider API.
   *  Called once per installation. Should handle errors internally and return fallback data. */
  readonly enrichInstallation: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      id: string;
      externalId: string;
      providerAccountInfo: unknown;
    }
  ) => Promise<NormalizedInstallation>;
  /** How installations are displayed: multi=select dropdown, merged=all fetched, single=static label */
  readonly installationMode: InstallationMode;

  /** List resources for a single installation, returning normalized items.
   *  Called per installation (merged mode calls this for each).
   *  Installation context is included so providers can read providerAccountInfo
   *  (e.g. Vercel needs team_id from providerAccountInfo.raw to scope the API call). */
  readonly listResources: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      readonly id: string;
      readonly externalId: string;
      readonly providerAccountInfo: unknown;
    }
  ) => Promise<NormalizedResource[]>;
  /** Human label for resources, e.g. "repositories", "projects", "teams" */
  readonly resourceLabel: string;
}

// ── Shared base fields (common to all provider tiers) ───────────────────────

interface BaseProviderFields<
  TConfig,
  TCategories extends Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition>,
  TAccountInfoSchema extends z.ZodObject,
  TProviderConfigSchema extends z.ZodObject,
  TApi extends ProviderApi = ProviderApi,
> extends Readonly<ProviderDisplayEntry> {
  readonly accountInfoSchema: TAccountInfoSchema;
  readonly api: TApi;
  /** Build the providerConfig JSONB blob for a new workspace integration record. */
  readonly buildProviderConfig: (params: {
    defaultSyncEvents: readonly string[];
  }) => z.infer<TProviderConfigSchema>;
  readonly categories: TCategories;
  readonly configSchema: z.ZodType<TConfig>;
  /** Build runtime config from validated env + runtime values.
   *  Returns null for optional providers when their env vars are absent. */
  readonly createConfig: (
    env: Record<string, string>,
    runtime: RuntimeConfig
  ) => TConfig | null;
  /** Default sync event keys enabled when linking a new resource. Must be a subset of category keys. */
  readonly defaultSyncEvents: readonly string[];
  /** Map sourceType to observation type string for storage. */
  readonly deriveObservationType: (sourceType: string) => string;
  /** Declarative edge rules for entity-mediated relationship detection */
  readonly edgeRules?: EdgeRule[];
  /** Pre-built createEnv() preset — for use in @t3-oss/env-core `extends` arrays.
   *  Lazy: only validates on first access. */
  readonly env: Record<string, string>;
  /** Plain Zod schemas for required process.env vars — no @t3-oss wrapper */
  readonly envSchema: Record<string, z.ZodType>;
  readonly events: TEvents;
  /** Map detailed internal sourceType to base config sync event key for filtering. */
  readonly getBaseEventType: (sourceType: string) => string;
  /** Optional connection health probe — enables 401-poll cron for revocation detection */
  readonly healthCheck?: HealthCheckDef<TConfig>;
  /** When true, all env vars are optional — the provider is disabled and its env preset is excluded from PROVIDER_ENVS(). */
  readonly optional?: true;
  /** Zod schema for the provider_config JSONB blob stored in workspace_integrations. */
  readonly providerConfigSchema: TProviderConfigSchema;
  /** Normalize wire eventType to dispatch category key. Use identity `(et) => et` if 1:1. */
  readonly resolveCategory: (eventType: string) => string;
  /** UI resource picker configuration for sources/new — installation enrichment + resource listing */
  readonly resourcePicker: ResourcePickerDef;
}

// ── Tier 1: WebhookProvider ─────────────────────────────────────────────────

/**
 * Webhook + OAuth provider (GitHub, Linear, Sentry, Vercel).
 * Receives events via HMAC-signed webhook POST. Authenticates via OAuth2 or App-token.
 *
 * TAuth is inferred from the `auth` block passed to `defineWebhookProvider`, giving
 * each concrete provider its exact auth type (e.g. `OAuthDef<LinearConfig>` for Linear,
 * `AppTokenDef<GitHubConfig>` for GitHub) — no narrowing ceremony at call sites.
 */
export interface WebhookProvider<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TAuth extends
    | OAuthDef<TConfig, TAccountInfo>
    | AppTokenDef<TConfig, TAccountInfo> =
    | OAuthDef<TConfig, TAccountInfo>
    | AppTokenDef<TConfig, TAccountInfo>,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
  TApi extends ProviderApi = ProviderApi,
> extends BaseProviderFields<
    TConfig,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema,
    TApi
  > {
  /** Auth strategy — inferred as the specific concrete auth type for this provider */
  readonly auth: TAuth;
  /** Historical data import */
  readonly backfill: BackfillDef;
  /** Discriminant — injected by defineWebhookProvider() */
  readonly kind: "webhook";
  /** HMAC verification + event extraction */
  readonly webhook: WebhookDef<TConfig>;
}

// ── Tier 2: ManagedProvider ──────────────────────────────────────────────────

/**
 * Managed webhook provider (HubSpot, Stripe, etc.).
 * Programmatically registers/unregisters webhooks with the provider on connection
 * setup/teardown. Auth via OAuth or API key. Inbound events arrive via signed POST.
 *
 * Runtime wiring (DB migration for webhookSetupState, relay guard migration,
 * gateway managed-provider setup flow) is deferred until a concrete managed provider
 * is added. This phase establishes the complete type architecture.
 */
export interface ManagedProvider<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
  TApi extends ProviderApi = ProviderApi,
> extends BaseProviderFields<
    TConfig,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema,
    TApi
  > {
  /** Auth strategy — OAuth or API key */
  readonly auth: AuthDef<TConfig, TAccountInfo>;
  /** Optional: historical data import */
  readonly backfill?: BackfillDef;
  /** Programmatic webhook lifecycle + inbound event handling */
  readonly inbound: ManagedWebhookDef<TConfig>;
  /** Discriminant — injected by defineManagedProvider() */
  readonly kind: "managed";
}

// ── Tier 3: ApiProvider ─────────────────────────────────────────────────────

/**
 * API-only provider (Apollo, HubSpot, Salesforce, etc.).
 * Never receives inbound webhooks. Auth via OAuth or API key.
 */
export interface ApiProvider<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
  TApi extends ProviderApi = ProviderApi,
> extends BaseProviderFields<
    TConfig,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema,
    TApi
  > {
  /** Auth strategy — OAuth or API key */
  readonly auth: AuthDef<TConfig, TAccountInfo>;
  /** Optional: historical data import */
  readonly backfill?: BackfillDef;
  /** Discriminant — injected by defineApiProvider() */
  readonly kind: "api";
  // No webhook, classifier, or lifecycle — API providers never receive inbound events
}

// ── Discriminated Union ─────────────────────────────────────────────────────

/** All provider definitions — discriminated by `kind` */
export type ProviderDefinition<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
  TApi extends ProviderApi = ProviderApi,
> =
  | WebhookProvider<
      TConfig,
      TAccountInfo,
      OAuthDef<TConfig, TAccountInfo> | AppTokenDef<TConfig, TAccountInfo>,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema,
      TApi
    >
  | ManagedProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema,
      TApi
    >
  | ApiProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema,
      TApi
    >;

// ── Type Guards ─────────────────────────────────────────────────────────────

export function isWebhookProvider(p: { kind: string }): p is WebhookProvider {
  return p.kind === "webhook";
}

export function isManagedProvider(p: { kind: string }): p is ManagedProvider {
  return p.kind === "managed";
}

export function isApiProvider(p: { kind: string }): p is ApiProvider {
  return p.kind === "api";
}

/**
 * True for providers that receive inbound webhooks — either natively (WebhookProvider)
 * or via programmatic registration (ManagedProvider).
 * Used by relay middleware to gate webhook handling.
 */
export function hasInboundWebhooks(p: {
  kind: string;
}): p is WebhookProvider | ManagedProvider {
  return p.kind === "webhook" || p.kind === "managed";
}

// ── Shared env-getter factory helper ────────────────────────────────────────

function buildEnvGetter(
  envSchema: Record<string, z.ZodType>
): Record<string, string> {
  return createEnv({
    clientPrefix: "" as const,
    client: {},
    // SAFETY: envSchema values are always z.string() variants (env vars are strings).
    server: envSchema as Record<string, z.ZodType<string>>,
    runtimeEnv: Object.fromEntries(
      Object.keys(envSchema).map((k) => [k, process.env[k]])
    ),
    skipValidation:
      !!process.env.SKIP_ENV_VALIDATION ||
      process.env.npm_lifecycle_event === "lint",
    emptyStringAsUndefined: true,
  });
}

// ── Factories ───────────────────────────────────────────────────────────────

/**
 * Create a type-safe webhook + OAuth provider definition.
 * Injects `kind: "webhook"` and the lazy `env` getter automatically.
 *
 * Do NOT pass explicit type arguments — let TypeScript infer all generics
 * to preserve the narrow literal types for categories and events.
 */
export function defineWebhookProvider<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TAuth extends
    | OAuthDef<TConfig, TAccountInfo>
    | AppTokenDef<TConfig, TAccountInfo> =
    | OAuthDef<TConfig, TAccountInfo>
    | AppTokenDef<TConfig, TAccountInfo>,
  const TCategories extends Record<string, CategoryDef> = Record<
    string,
    CategoryDef
  >,
  const TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
  const TApi extends ProviderApi = ProviderApi,
>(
  def: Omit<
    WebhookProvider<
      TConfig,
      TAccountInfo,
      TAuth,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema,
      TApi
    >,
    "env" | "kind"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): WebhookProvider<
  TConfig,
  TAccountInfo,
  TAuth,
  TCategories,
  TEvents,
  TAccountInfoSchema,
  TProviderConfigSchema,
  TApi
> {
  let _env: Record<string, string> | undefined;
  const result = {
    ...def,
    kind: "webhook" as const satisfies z.infer<typeof providerKindSchema>,
    get env(): Record<string, string> {
      _env ??= buildEnvGetter(def.envSchema);
      return _env;
    },
  };
  return Object.freeze(result) as WebhookProvider<
    TConfig,
    TAccountInfo,
    TAuth,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema,
    TApi
  >;
}

/**
 * Create a type-safe API-only provider definition.
 * Injects `kind: "api"` and the lazy `env` getter automatically.
 */
export function defineApiProvider<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  const TCategories extends Record<string, CategoryDef> = Record<
    string,
    CategoryDef
  >,
  const TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
  const TApi extends ProviderApi = ProviderApi,
>(
  def: Omit<
    ApiProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema,
      TApi
    >,
    "env" | "kind"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): ApiProvider<
  TConfig,
  TAccountInfo,
  TCategories,
  TEvents,
  TAccountInfoSchema,
  TProviderConfigSchema,
  TApi
> {
  let _env: Record<string, string> | undefined;
  const result = {
    ...def,
    kind: "api" as const satisfies z.infer<typeof providerKindSchema>,
    get env(): Record<string, string> {
      _env ??= buildEnvGetter(def.envSchema);
      return _env;
    },
  };
  return Object.freeze(result) as ApiProvider<
    TConfig,
    TAccountInfo,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema,
    TApi
  >;
}

/**
 * Create a type-safe managed webhook provider definition.
 * Injects `kind: "managed"` and the lazy `env` getter automatically.
 *
 * Do NOT pass explicit type arguments — let TypeScript infer all generics
 * to preserve the narrow literal types for categories and events.
 */
export function defineManagedProvider<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  const TCategories extends Record<string, CategoryDef> = Record<
    string,
    CategoryDef
  >,
  const TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
  const TApi extends ProviderApi = ProviderApi,
>(
  def: Omit<
    ManagedProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema,
      TApi
    >,
    "env" | "kind"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): ManagedProvider<
  TConfig,
  TAccountInfo,
  TCategories,
  TEvents,
  TAccountInfoSchema,
  TProviderConfigSchema,
  TApi
> {
  let _env: Record<string, string> | undefined;
  const result = {
    ...def,
    kind: "managed" as const satisfies z.infer<typeof providerKindSchema>,
    get env(): Record<string, string> {
      _env ??= buildEnvGetter(def.envSchema);
      return _env;
    },
  };
  return Object.freeze(result) as ManagedProvider<
    TConfig,
    TAccountInfo,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema,
    TApi
  >;
}

// ── Display-Layer Types ──────────────────────────────────────────────────────
// IconDef and iconDefSchema live in icon.ts — re-exported for consumers.
export { type IconDef, iconDefSchema } from "./icon";
