import type { z } from "zod";
import type { PostTransformEvent, SourceType } from "@repo/console-validation";
import type { TransformContext, OAuthTokens, CallbackResult } from "./types.js";

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

/** Runtime values not sourced from env (e.g. callbackBaseUrl) */
export interface RuntimeConfig {
  callbackBaseUrl: string;
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
  /** Plain Zod schemas for required process.env vars — no @t3-oss wrapper */
  readonly envSchema: Record<string, z.ZodType>;
  /** Build runtime config from validated env + runtime values */
  readonly createConfig: (env: Record<string, string>, runtime: RuntimeConfig) => TConfig;
}

/** Create a type-safe provider definition */
export function defineProvider<TConfig>(
  def: ProviderDefinition<TConfig>,
): ProviderDefinition<TConfig> {
  return Object.freeze(def);
}
