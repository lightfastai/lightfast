import { createEnv } from "@t3-oss/env-core";
import type { z } from "zod";
import type { PostTransformEvent } from "./post-transform-event";
import type { TransformContext, OAuthTokens, BaseProviderAccountInfo, CallbackResult } from "./types";

export interface CategoryDef {
  label: string;
  description: string;
  type: "observation" | "sync+observation";
}

/** Per-action sub-event definition (e.g., "opened", "merged" for pull_request) */
export interface ActionDef {
  label: string;
  weight: number;
}

/** Simple event — no sub-actions */
export interface SimpleEventDef<S extends z.ZodType = z.ZodType> {
  readonly kind: "simple";
  readonly label: string;
  readonly weight: number;
  readonly schema: S;
  readonly transform: (payload: z.infer<S>, ctx: TransformContext) => PostTransformEvent;
}

/** Event with sub-actions (e.g., PR opened/closed/merged) */
export interface ActionEventDef<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> = Record<string, ActionDef>,
> {
  readonly kind: "with-actions";
  readonly label: string;
  readonly weight: number;
  readonly schema: S;
  readonly transform: (payload: z.infer<S>, ctx: TransformContext) => PostTransformEvent;
  readonly actions: TActions;
}

/** Discriminated union — switches on `kind` */
export type EventDefinition<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> = Record<string, ActionDef>,
> = SimpleEventDef<S> | ActionEventDef<S, TActions>;

/** Factory: simple event (no sub-actions) */
export function simpleEvent<S extends z.ZodType>(
  def: Omit<SimpleEventDef<S>, "kind">,
): SimpleEventDef<S> {
  return { kind: "simple", ...def };
}

/** Factory: event with sub-actions */
export function actionEvent<S extends z.ZodType, const TActions extends Record<string, ActionDef>>(
  def: Omit<ActionEventDef<S, TActions>, "kind">,
): ActionEventDef<S, TActions> {
  return { kind: "with-actions", ...def };
}

/** @deprecated Use simpleEvent() or actionEvent() */
export const defineEvent = simpleEvent;

/** Webhook extraction functions — pure, no env/DB/framework */
export interface WebhookDef<TConfig> {
  /** Zod schema for required webhook headers — validated before body read.
   *  Keys are lowercase header names. Used by relay middleware for early rejection.
   *  Must be a z.object() with string-valued fields (required or optional). */
  readonly headersSchema: z.ZodObject<Record<string, z.ZodType<string | undefined>>>;
  extractSecret: (config: TConfig) => string;
  verifySignature: (rawBody: string, headers: Headers, secret: string) => boolean;
  extractEventType: (headers: Headers, payload: unknown) => string;
  extractDeliveryId: (headers: Headers, payload: unknown) => string;
  extractResourceId: (payload: unknown) => string | null;
  parsePayload: (raw: unknown) => unknown;
}

/** OAuth functions — pure fetch, no env/DB/framework */
export interface OAuthDef<TConfig, TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo> {
  buildAuthUrl: (config: TConfig, state: string, options?: Record<string, unknown>) => string;
  exchangeCode: (config: TConfig, code: string, redirectUri: string) => Promise<OAuthTokens>;
  refreshToken: (config: TConfig, refreshToken: string) => Promise<OAuthTokens>;
  revokeToken: (config: TConfig, accessToken: string) => Promise<void>;
  /** Extract params from callback query string, call provider APIs, return result. No DB, no Hono. */
  processCallback: (config: TConfig, query: Record<string, string>) => Promise<CallbackResult<TAccountInfo>>;
  /**
   * Get a usable bearer token for API calls.
   * Standard OAuth providers return storedAccessToken directly.
   * GitHub App generates a JWT-based installation token on-demand.
   */
  getActiveToken: (config: TConfig, storedExternalId: string, storedAccessToken: string | null) => Promise<string>;
  /** Whether the provider stores OAuth tokens in the DB. False for providers that generate tokens on-demand (e.g., GitHub App JWT). */
  readonly usesStoredToken: boolean;
}

/** Runtime values not sourced from env (e.g. callbackBaseUrl) */
export interface RuntimeConfig {
  callbackBaseUrl: string;
}

export interface ProviderDefinition<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<string, EventDefinition>,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
> {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly configSchema: z.ZodType<TConfig>;
  readonly accountInfoSchema: TAccountInfoSchema;
  /** Zod schema for the provider_config JSONB blob stored in workspace_integrations. */
  readonly providerConfigSchema: TProviderConfigSchema;
  readonly categories: TCategories;
  readonly events: TEvents;
  /** Default sync event keys enabled when linking a new resource. Must be a subset of category keys. */
  readonly defaultSyncEvents: readonly string[];
  readonly webhook: WebhookDef<TConfig>;
  readonly oauth: OAuthDef<TConfig, TAccountInfo>;
  /** Normalize wire eventType to dispatch category key. Use identity `(et) => et` if 1:1. */
  readonly resolveCategory: (eventType: string) => string;
  /** Map detailed internal sourceType to base config sync event key for filtering. */
  readonly getBaseEventType: (sourceType: string) => string;
  /** Map sourceType to observation type string for storage. */
  readonly deriveObservationType: (sourceType: string) => string;
  /** Plain Zod schemas for required process.env vars — no @t3-oss wrapper */
  readonly envSchema: Record<string, z.ZodType>;
  /** Pre-built createEnv() preset — for use in @t3-oss/env-core `extends` arrays.
   *  Lazy: only validates on first access. */
  readonly env: Record<string, string>;
  /** Build runtime config from validated env + runtime values */
  readonly createConfig: (env: Record<string, string>, runtime: RuntimeConfig) => TConfig;
  /** Build the providerConfig JSONB blob for a new workspace integration record. */
  readonly buildProviderConfig: (params: {
    resourceId: string;
    resourceName: string;
    installationExternalId: string;
    providerAccountInfo: BaseProviderAccountInfo | null;
    defaultSyncEvents: readonly string[];
  }) => z.infer<TProviderConfigSchema>;
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
  const TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  const TEvents extends Record<string, EventDefinition> = Record<string, EventDefinition>,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
>(
  def: Omit<ProviderDefinition<TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema>, "env">
    & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] },
): ProviderDefinition<TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema> {
  let _env: Record<string, string> | undefined;
  const result = {
    ...def,
    get env(): Record<string, string> {
      _env ??= createEnv({
        clientPrefix: "" as const,
        client: {},
        server: def.envSchema as Record<string, z.ZodType<string>>,
        runtimeEnv: Object.fromEntries(
          Object.keys(def.envSchema).map((k) => [k, process.env[k]]),
        ),
        skipValidation:
          !!process.env.SKIP_ENV_VALIDATION ||
          process.env.npm_lifecycle_event === "lint",
        emptyStringAsUndefined: true,
      });
      return _env;
    },
  };
  return Object.freeze(result) as ProviderDefinition<TConfig, TAccountInfo, TCategories, TEvents, TAccountInfoSchema, TProviderConfigSchema>;
}

// ── Display-Layer Types ──────────────────────────────────────────────────────

/** Framework-agnostic SVG icon data — renderable by any UI layer */
export interface IconDef {
  readonly viewBox: string;
  readonly d: string;
}
