import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import type { PostTransformEvent } from "./post-transform-event";
import type {
  BaseProviderAccountInfo,
  CallbackResult,
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
    resourceName: z.string().nullable(),
  }),
  /** ISO timestamp = now - depth days */
  since: z.string(),
});

export type BackfillContext = z.infer<typeof backfillContextSchema>;

// ── API Surface interfaces (contain functions — cannot be Zod) ──────────────────

export interface ApiEndpoint {
  /** HTTP method */
  readonly method: "GET" | "POST";
  /** URL path template with {param} placeholders. Example: "/repos/{owner}/{repo}/pulls" */
  readonly path: string;
  /** Human-readable description */
  readonly description: string;
  /** Request timeout in ms. Default: 30_000 */
  readonly timeout?: number;
  /** Zod schema for the response body. Uses .passthrough() to allow extra fields. */
  readonly responseSchema: z.ZodType;
}

export interface ProviderApi {
  /** Base URL for the provider's API. Example: "https://api.github.com" */
  readonly baseUrl: string;
  /** Default headers for all API calls. */
  readonly defaultHeaders?: Record<string, string>;
  /** Build the Authorization header value from the active token.
   *  Default behavior (when omitted): `Bearer ${token}`. */
  readonly buildAuthHeader?: (token: string) => string;
  /** Parse rate-limit info from response headers. Return null if not parseable.
   *  This is an API-level concern — consumed by callers, never by gateway. */
  readonly parseRateLimit: (headers: Headers) => RateLimit | null;
  /** Available API endpoints, keyed by a stable identifier */
  readonly endpoints: Record<string, ApiEndpoint>;
}

// ── Backfill interfaces (contain functions — cannot be Zod) ─────────────────────

/** How to backfill a single entity type using a provider API endpoint */
export interface BackfillEntityHandler {
  /** Which API endpoint to use from the provider's api.endpoints catalog */
  readonly endpointId: string;
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

/** Backfill definition — required on every ProviderDefinition */
export interface BackfillDef {
  readonly supportedEntityTypes: readonly string[];
  readonly defaultEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
}

export interface ProviderDefinition<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
> {
  readonly accountInfoSchema: TAccountInfoSchema;
  /** Build the providerConfig JSONB blob for a new workspace integration record. */
  readonly buildProviderConfig: (params: {
    resourceId: string;
    resourceName: string;
    installationExternalId: string;
    providerAccountInfo: BaseProviderAccountInfo | null;
    defaultSyncEvents: readonly string[];
  }) => z.infer<TProviderConfigSchema>;
  readonly categories: TCategories;
  readonly configSchema: z.ZodType<TConfig>;
  /** Build runtime config from validated env + runtime values */
  readonly createConfig: (
    env: Record<string, string>,
    runtime: RuntimeConfig
  ) => TConfig;
  /** Default sync event keys enabled when linking a new resource. Must be a subset of category keys. */
  readonly defaultSyncEvents: readonly string[];
  /** Map sourceType to observation type string for storage. */
  readonly deriveObservationType: (sourceType: string) => string;
  readonly api: ProviderApi;
  readonly backfill: BackfillDef;
  readonly description: string;
  readonly displayName: string;
  /** Pre-built createEnv() preset — for use in @t3-oss/env-core `extends` arrays.
   *  Lazy: only validates on first access. */
  readonly env: Record<string, string>;
  /** Plain Zod schemas for required process.env vars — no @t3-oss wrapper */
  readonly envSchema: Record<string, z.ZodType>;
  readonly events: TEvents;
  /** Map detailed internal sourceType to base config sync event key for filtering. */
  readonly getBaseEventType: (sourceType: string) => string;
  readonly name: string;
  readonly oauth: OAuthDef<TConfig, TAccountInfo>;
  /** Zod schema for the provider_config JSONB blob stored in workspace_integrations. */
  readonly providerConfigSchema: TProviderConfigSchema;
  /** Normalize wire eventType to dispatch category key. Use identity `(et) => et` if 1:1. */
  readonly resolveCategory: (eventType: string) => string;
  readonly webhook: WebhookDef<TConfig>;
}

/**
 * Create a type-safe provider definition.
 * Uses const generics to preserve literal keys for categories/events,
 * enabling type-level derivation of EVENT_REGISTRY and EventKey.
 *
 * Do NOT pass explicit type arguments — let TypeScript infer all three
 * to preserve the narrow literal types for categories and events.
 */
export function defineProvider<
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
    ProviderDefinition<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema
    >,
    "env"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): ProviderDefinition<
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
    get env(): Record<string, string> {
      _env ??= createEnv({
        clientPrefix: "" as const,
        client: {},
        server: def.envSchema as Record<string, z.ZodType<string>>,
        runtimeEnv: Object.fromEntries(
          Object.keys(def.envSchema).map((k) => [k, process.env[k]])
        ),
        skipValidation:
          !!process.env.SKIP_ENV_VALIDATION ||
          process.env.npm_lifecycle_event === "lint",
        emptyStringAsUndefined: true,
      });
      return _env;
    },
  };
  return Object.freeze(result) as ProviderDefinition<
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
