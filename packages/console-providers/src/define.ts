import type { z } from "zod";
import type { PostTransformEvent } from "./post-transform-event.js";
import type { TransformContext, OAuthTokens, ProviderAccountInfo, TypedCallbackResult } from "./types.js";

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

export interface EventDefinition<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> | undefined = Record<string, ActionDef> | undefined,
> {
  label: string;
  weight: number;
  schema: S;
  transform: (payload: z.infer<S>, ctx: TransformContext) => PostTransformEvent;
  /** Fine-grained per-action sub-events. When present, each action becomes a separate registry entry. */
  actions?: TActions;
}

/** Type-safe event definition — preserves literal action keys via const generic */
export function defineEvent<
  S extends z.ZodType,
  const TActions extends Record<string, ActionDef> | undefined = undefined,
>(
  def: EventDefinition<S, TActions>,
): EventDefinition<S, TActions> {
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

/** Runtime values not sourced from env (e.g. callbackBaseUrl) */
export interface RuntimeConfig {
  callbackBaseUrl: string;
}

export interface ProviderDefinition<
  TConfig = unknown,
  TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  TEvents extends Record<string, EventDefinition> = Record<string, EventDefinition>,
> {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly configSchema: z.ZodType<TConfig>;
  readonly categories: TCategories;
  readonly events: TEvents;
  readonly webhook: WebhookDef<TConfig>;
  readonly oauth: OAuthDef<TConfig>;
  /** Provider-specific capabilities (e.g., GitHub JWT, Linear GraphQL) */
  readonly capabilities?: Record<string, (...args: unknown[]) => unknown>;
  /** Normalize wire eventType to dispatch category key. Default: identity. */
  readonly resolveCategory?: (eventType: string) => string;
  /** Plain Zod schemas for required process.env vars — no @t3-oss wrapper */
  readonly envSchema: Record<string, z.ZodType>;
  /** Build runtime config from validated env + runtime values */
  readonly createConfig: (env: Record<string, string>, runtime: RuntimeConfig) => TConfig;
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
  const TCategories extends Record<string, CategoryDef> = Record<string, CategoryDef>,
  const TEvents extends Record<string, EventDefinition> = Record<string, EventDefinition>,
>(
  def: ProviderDefinition<TConfig, TCategories, TEvents>,
): ProviderDefinition<TConfig, TCategories, TEvents> {
  return Object.freeze(def) as ProviderDefinition<TConfig, TCategories, TEvents>;
}
