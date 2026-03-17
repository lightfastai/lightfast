import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import type { ProxyExecuteResponse } from "./gateway";
import type { PostTransformEvent } from "./post-transform-event";
import type {
  BaseProviderAccountInfo,
  CallbackResult,
  EdgeRule,
  OAuthTokens,
  TransformContext,
} from "./types";

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
  verifySignature: (
    rawBody: string,
    headers: Headers,
    secret: string
  ) => boolean;
}

/** OAuth functions — pure fetch, no env/DB/framework */
export interface OAuthDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> {
  buildAuthUrl: (
    config: TConfig,
    state: string,
    options?: Record<string, unknown>
  ) => string;
  exchangeCode: (
    config: TConfig,
    code: string,
    redirectUri: string
  ) => Promise<OAuthTokens>;
  /**
   * Get a usable bearer token for API calls.
   * Standard OAuth providers return storedAccessToken directly.
   * GitHub App generates a JWT-based installation token on-demand.
   */
  getActiveToken: (
    config: TConfig,
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  readonly kind: "oauth";
  /** Extract params from callback query string, call provider APIs, return result. No DB, no Hono. */
  processCallback: (
    config: TConfig,
    query: Record<string, string>
  ) => Promise<CallbackResult<TAccountInfo>>;
  refreshToken: (config: TConfig, refreshToken: string) => Promise<OAuthTokens>;
  revokeToken: (config: TConfig, accessToken: string) => Promise<void>;
  /** Whether the provider stores OAuth tokens in the DB. False for providers that generate tokens on-demand (e.g., GitHub App JWT). */
  readonly usesStoredToken: boolean;
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

/** Discriminated union of all auth strategies */
export type AuthDef<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> = OAuthDef<TConfig, TAccountInfo> | ApiKeyDef<TConfig, TAccountInfo>;

// ── Event Classifier ────────────────────────────────────────────────────────

/**
 * Classifies a raw wire event into a routing decision.
 * Lives on WebhookProvider — enables the platform to route lifecycle vs data events.
 */
export interface EventClassifier {
  /**
   * Classify a raw wire event type + optional action into a routing decision.
   * - "lifecycle": installation/connection management events → connectionLifecycleWorkflow
   * - "data":      content events (PRs, issues, deployments) → QStash → console ingest
   * - "unknown":   unrecognized events → DLQ
   */
  classify(
    eventType: string,
    action?: string
  ): "lifecycle" | "data" | "unknown";
}

// ── Lifecycle Def ───────────────────────────────────────────────────────────

export type LifecycleReason =
  | "provider_revoked" // installation.deleted
  | "provider_suspended" // installation.suspend
  | "provider_unsuspended" // installation.unsuspend
  | "provider_repo_removed" // installation_repositories.removed
  | "provider_repo_deleted"; // repository.deleted, project.removed

/**
 * Maps wire lifecycle events to structured reasons + optional resource IDs.
 * Lives on WebhookProvider — consumed by connectionLifecycleWorkflow.
 */
export interface LifecycleDef {
  readonly events: Record<
    string, // wire eventType (e.g. "installation", "repository")
    (
      action: string | undefined,
      payload: unknown
    ) => { reason: LifecycleReason; resourceIds?: string[] } | null
  >;
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

// ── Backfill schemas ────────────────────────────────────────────────────────────

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
  // biome-ignore lint/correctness/noUnusedVariables: used by WebhookProvider.auth and ApiProvider.auth
  TAccountInfo extends BaseProviderAccountInfo,
  TCategories extends Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition>,
  TAccountInfoSchema extends z.ZodObject,
  TProviderConfigSchema extends z.ZodObject,
> {
  readonly accountInfoSchema: TAccountInfoSchema;
  readonly api: ProviderApi;
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
  readonly description: string;
  readonly displayName: string;
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
  readonly name: string;
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
 * Receives events via HMAC-signed webhook POST. Authenticates via OAuth2.
 */
export interface WebhookProvider<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
> extends BaseProviderFields<
    TConfig,
    TAccountInfo,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema
  > {
  /** Auth strategy — always OAuth for webhook providers */
  readonly auth: OAuthDef<TConfig, TAccountInfo>;
  /** Historical data import */
  readonly backfill: BackfillDef;
  /** Classifies incoming events as lifecycle | data | unknown */
  readonly classifier: EventClassifier;
  /** Discriminant — injected by defineWebhookProvider() */
  readonly kind: "webhook";
  /** Maps lifecycle wire events to structured reasons + resource IDs */
  readonly lifecycle: LifecycleDef;
  /** HMAC verification + event extraction */
  readonly webhook: WebhookDef<TConfig>;
}

// ── Tier 2: ApiProvider ─────────────────────────────────────────────────────

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
> extends BaseProviderFields<
    TConfig,
    TAccountInfo,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema
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
> =
  | WebhookProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema
    >
  | ApiProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema
    >;

// ── Type Guards ─────────────────────────────────────────────────────────────

export function isWebhookProvider(p: { kind: string }): p is WebhookProvider {
  return p.kind === "webhook";
}

export function isApiProvider(p: { kind: string }): p is ApiProvider {
  return p.kind === "api";
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
>(
  def: Omit<
    WebhookProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema
    >,
    "env" | "kind"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): WebhookProvider<
  TConfig,
  TAccountInfo,
  TCategories,
  TEvents,
  TAccountInfoSchema,
  TProviderConfigSchema
> {
  let _env: Record<string, string> | undefined;
  const result = {
    ...def,
    kind: "webhook" as const,
    get env(): Record<string, string> {
      _env ??= buildEnvGetter(def.envSchema);
      return _env;
    },
  };
  return Object.freeze(result) as WebhookProvider<
    TConfig,
    TAccountInfo,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema
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
>(
  def: Omit<
    ApiProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema
    >,
    "env" | "kind"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): ApiProvider<
  TConfig,
  TAccountInfo,
  TCategories,
  TEvents,
  TAccountInfoSchema,
  TProviderConfigSchema
> {
  let _env: Record<string, string> | undefined;
  const result = {
    ...def,
    kind: "api" as const,
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
    TProviderConfigSchema
  >;
}


// ── Display-Layer Types ──────────────────────────────────────────────────────

/** Framework-agnostic SVG icon data — renderable by any UI layer */
export const iconDefSchema = z.object({
  d: z.string(),
  viewBox: z.string(),
});
export type IconDef = z.infer<typeof iconDefSchema>;
