import type { z } from "zod";
import type { ProviderDisplayEntry } from "../client/display";
import type { HealthCheckDef, ProviderApi, RuntimeConfig } from "./api";
import type { AuthDef } from "./auth";
import type { BackfillDef } from "./backfill";
import type { EventDefinition } from "./events";
import type { CategoryDef } from "./kinds";
import type { BaseProviderAccountInfo, EdgeRule } from "./primitives";
import type { ResourcePickerDef } from "./resource-picker";
import type {
  InboundWebhookDef,
  ManagedWebhookDef,
  WebhookDef,
} from "./webhook";

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
  readonly resourcePicker: ResourcePickerDef<z.infer<TAccountInfoSchema> | null>;
}

// ── Tier 1: WebhookProvider ─────────────────────────────────────────────────

/**
 * Webhook provider (GitHub, Linear, Sentry, Vercel, Stripe, etc.).
 * Receives events via signed webhook POST. Authenticates via OAuth2, App-token, or API key.
 *
 * TAuth is inferred from the `auth` block passed to `defineWebhookProvider`, giving
 * each concrete provider its exact auth type (e.g. `OAuthDef<LinearConfig>` for Linear,
 * `AppTokenDef<GitHubConfig>` for GitHub) — no narrowing ceremony at call sites.
 */
export interface WebhookProvider<
  TConfig = unknown,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TAuth extends AuthDef<TConfig, TAccountInfo> = AuthDef<TConfig, TAccountInfo>,
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
 * Runtime wiring (DB migration for webhookSetupState, platform webhook guard,
 * platform managed-provider setup flow) is deferred until a concrete managed provider
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
  /** Optional inbound webhook reception — for API-key providers with manual webhook setup */
  readonly inbound?: InboundWebhookDef<TConfig>;
  /** Discriminant — injected by defineApiProvider() */
  readonly kind: "api";
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
      AuthDef<TConfig, TAccountInfo>,
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

type ProviderWithInboundWebhooks =
  | WebhookProvider
  | ManagedProvider
  | (ApiProvider & { readonly inbound: InboundWebhookDef<unknown> });

/**
 * True for providers that receive inbound webhooks — natively (WebhookProvider),
 * via programmatic registration (ManagedProvider), or via manual customer setup
 * (ApiProvider with an `inbound` field, e.g. Clerk, Datadog).
 * Used by the platform webhook handler to gate webhook handling.
 */
export function hasInboundWebhooks(
  p: ProviderDefinition
): p is ProviderWithInboundWebhooks {
  if (p.kind === "webhook" || p.kind === "managed") {
    return true;
  }
  if (p.kind === "api" && p.inbound != null) {
    return true;
  }
  return false;
}

// ── Display-Layer Types ──────────────────────────────────────────────────────
// IconDef and iconDefSchema live in icon.ts — re-exported for consumers.
export { type IconDef, iconDefSchema } from "../icon";
