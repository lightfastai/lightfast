import { z } from "zod";
import type {
  ActionEventDef,
  EventDefinition,
  ProviderDefinition,
  ProxyExecuteRequest,
} from "./define";
import type { PROVIDER_DISPLAY, ProviderSlug } from "./display";
import { providerSlugSchema } from "./display";
import { apollo } from "./providers/apollo/index";
import { github } from "./providers/github/index";
import { linear } from "./providers/linear/index";
import { sentry } from "./providers/sentry/index";
import { vercel } from "./providers/vercel/index";

// ── The Registry ──────────────────────────────────────────────────────────────

// ProviderConfigMap removed — factory functions enforce type correctness at each
// provider's call site. PROVIDERS is plain `as const` for maximum type narrowing.
export const PROVIDERS = {
  apollo,
  github,
  vercel,
  linear,
  sentry,
} as const;

// ── SourceType / ProviderName — aliases of ProviderSlug ──────────────────────

export type { ProviderSlug } from "./display";
// sourceTypeSchema IS providerSlugSchema — single canonical source.
export { providerSlugSchema as sourceTypeSchema } from "./display";

// Semantic aliases — structurally identical to ProviderSlug.
export type ProviderName = ProviderSlug;
export type SourceType = ProviderSlug;

// ── Compile-time display completeness enforcement ────────────────────────────
// Derive "live" display keys — entries without comingSoon: true.
type _LiveDisplayKeys = {
  [K in keyof typeof PROVIDER_DISPLAY]: (typeof PROVIDER_DISPLAY)[K] extends {
    comingSoon: true;
  }
    ? never
    : K;
}[keyof typeof PROVIDER_DISPLAY];

// _MissingProviders = live display entries with no PROVIDERS implementation.
// Non-empty → the declared type cannot be 'true' → TypeScript error names the slug(s).
type _MissingProviders = Exclude<_LiveDisplayKeys, keyof typeof PROVIDERS>;
type _AssertDisplayComplete = [_MissingProviders] extends [never]
  ? true
  : {
      "ERROR — add to PROVIDERS or mark comingSoon: true in display.ts": _MissingProviders;
    };
// Zero runtime overhead — declare const is type-checked only.
declare const _assertDisplayComplete: _AssertDisplayComplete;

// ── Type-Level Event Key Derivation ──────────────────────────────────────────

/**
 * Extract concrete action keys from an EventDefinition.
 * Returns the actions record if it has specific literal keys (not just `string`).
 * Returns `never` for simple events without actions.
 */
type ActionsOf<E> =
  E extends ActionEventDef<infer _S, infer A>
    ? string extends keyof A
      ? never
      : A
    : never;

/** Derive event keys for a single provider from its events map */
type DeriveProviderKeys<P extends ProviderName> = {
  [E in keyof (typeof PROVIDERS)[P]["events"] & string]: [
    ActionsOf<(typeof PROVIDERS)[P]["events"][E]>,
  ] extends [never]
    ? `${P}:${E}`
    : `${P}:${E}.${keyof ActionsOf<(typeof PROVIDERS)[P]["events"][E]> & string}`;
}[keyof (typeof PROVIDERS)[P]["events"] & string];

/** All valid event keys — derived from provider definitions at the type level */
export type EventKey = {
  [P in ProviderName]: DeriveProviderKeys<P>;
}[ProviderName];

// ── Runtime Event Registry Derivation ────────────────────────────────────────

export const eventRegistryEntrySchema = z.object({
  category: z.string(),
  externalKeys: z.array(z.string()).readonly(),
  label: z.string(),
  source: providerSlugSchema,
  weight: z.number(),
});
export type EventRegistryEntry = z.infer<typeof eventRegistryEntrySchema>;

/** Derived event registry — single source of truth is the provider definitions */
export const EVENT_REGISTRY: Record<EventKey, EventRegistryEntry> = (() => {
  const registry: Record<string, EventRegistryEntry> = {};
  for (const [source, provider] of Object.entries(PROVIDERS)) {
    for (const [eventKey, eventDef] of Object.entries(provider.events)) {
      const def = eventDef as EventDefinition;
      if (def.kind === "with-actions") {
        for (const [action, actionDef] of Object.entries(def.actions)) {
          registry[`${source}:${eventKey}.${action}`] = {
            source: source as SourceType,
            label: actionDef.label,
            weight: actionDef.weight,
            externalKeys: [eventKey],
            category: eventKey,
          };
        }
      } else {
        registry[`${source}:${eventKey}`] = {
          source: source as SourceType,
          label: def.label,
          weight: def.weight,
          externalKeys: [eventKey],
          category: eventKey,
        };
      }
    }
  }
  return registry as Record<EventKey, EventRegistryEntry>;
})();

// ── eventKeySchema — runtime twin of EventKey ─────────────────────────────────
// Derived from EVENT_REGISTRY keys so compile-time and runtime representations
// stay in sync automatically.
const _eventKeys = Object.keys(EVENT_REGISTRY) as [EventKey, ...EventKey[]];
export const eventKeySchema = z.enum(_eventKeys);

// ── Account Info Schema ───────────────────────────────────────────────────────
// Auto-derived from PROVIDERS — adding a provider = add to PROVIDERS only.

type AllAccountInfoSchema =
  (typeof PROVIDERS)[keyof typeof PROVIDERS]["accountInfoSchema"];

const _accountInfoSchemas = Object.values(PROVIDERS).map(
  (p) => p.accountInfoSchema
) as [AllAccountInfoSchema, ...AllAccountInfoSchema[]];

export const providerAccountInfoSchema = z.discriminatedUnion(
  "sourceType",
  _accountInfoSchemas
);
export type ProviderAccountInfo = z.infer<typeof providerAccountInfoSchema>;

// ── Provider Config Schema ────────────────────────────────────────────────────
// Auto-derived from PROVIDERS — adding a provider = add to PROVIDERS only.

type AllProviderConfigSchema =
  (typeof PROVIDERS)[keyof typeof PROVIDERS]["providerConfigSchema"];

const _configSchemas = Object.values(PROVIDERS).map(
  (p) => p.providerConfigSchema
) as [AllProviderConfigSchema, ...AllProviderConfigSchema[]];

export const providerConfigSchema = z.discriminatedUnion(
  "provider",
  _configSchemas
);
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

// ── Phantom Provider Graph — type utilities for zero-runtime consumer coupling ──
//
// Usage in any consumer:
//   import type { ProviderShape, AuthDefFor } from "@repo/console-providers";
//   type GitHubAuth = AuthDefFor<"github">; // → AppTokenDef
//   (type-only import — erased before bundling, zero runtime cost)

/** Exact type of a provider by slug — narrows to the specific provider object shape. */
export type ProviderShape<K extends keyof typeof PROVIDERS> =
  (typeof PROVIDERS)[K];

/** Exact auth definition for a provider by slug. */
export type AuthDefFor<K extends keyof typeof PROVIDERS> =
  ProviderShape<K> extends { readonly auth: infer A } ? A : never;

/** Inferred account info type for a provider by slug. */
export type AccountInfoFor<K extends keyof typeof PROVIDERS> =
  ProviderShape<K> extends { accountInfoSchema: z.ZodType<infer A> }
    ? A
    : never;

/** Union of event key suffixes available for a provider by slug. */
export type EventKeysFor<K extends keyof typeof PROVIDERS> =
  ProviderShape<K> extends { events: Record<infer E extends string, unknown> }
    ? E
    : never;

// ── EndpointKey — compile-time mapped type ────────────────────────────────────
// Mirrors EventKey derivation from the Phantom Provider Graph pattern.
// Auto-updates when endpoints change.

/** All provider slugs — type alias for `keyof typeof PROVIDERS`. */
export type ProviderKey = keyof typeof PROVIDERS;

/** Union of endpoint IDs for a provider by slug. */
export type EndpointKey<P extends keyof typeof PROVIDERS> =
  keyof (typeof PROVIDERS)[P]["api"]["endpoints"] & string;

/** Wide union of all endpoint keys across all providers. */
export type AnyEndpointKey = {
  [P in keyof typeof PROVIDERS]: EndpointKey<P>;
}[keyof typeof PROVIDERS];

/** Union of endpoint keys available for a provider by slug. */
export type EndpointKeysFor<K extends keyof typeof PROVIDERS> = EndpointKey<K>;

// ── Path param extraction ──────────────────────────────────────────────────────

type ExtractPathParams<Path extends string> =
  Path extends `${string}{${infer Param}}${infer Rest}`
    ? Param | ExtractPathParams<Rest>
    : never;

/**
 * Required pathParams keys for a given provider + endpoint.
 * `undefined` if the path has no `{param}` placeholders.
 */
export type PathParamsFor<
  P extends keyof typeof PROVIDERS,
  E extends EndpointKey<P>,
> =
  ExtractPathParams<
    (typeof PROVIDERS)[P]["api"]["endpoints"][E]["path"]
  > extends never
    ? undefined
    : Record<
        ExtractPathParams<(typeof PROVIDERS)[P]["api"]["endpoints"][E]["path"]>,
        string
      >;

/**
 * Typed proxy request for a known provider + endpoint at compile time.
 * Use when the caller knows the provider slug and endpoint key statically.
 *
 * For runtime-dynamic calls (slug from DB): use the base ProxyExecuteRequest.
 */
export type TypedProxyRequest<
  P extends keyof typeof PROVIDERS,
  E extends EndpointKey<P>,
> = Omit<ProxyExecuteRequest, "endpointId" | "pathParams"> & {
  readonly endpointId: E;
  readonly pathParams: PathParamsFor<P, E>;
};

// ── ResponseDataFor — thread responseSchema to call sites ─────────────────────

/** Inferred response data type for a provider + endpoint. */
export type ResponseDataFor<
  P extends keyof typeof PROVIDERS,
  E extends EndpointKey<P>,
> = z.infer<(typeof PROVIDERS)[P]["api"]["endpoints"][E]["responseSchema"]>;

// ── HasBuildAuth — auth mode as type-level discriminant ───────────────────────

/**
 * True when endpoint[E] for provider[P] defines buildAuth (bypasses token vault).
 * False when it uses the default getActiveToken → token vault flow.
 *
 * Examples:
 *   HasBuildAuth<"github", "get-app-installation"> → true  (RS256 JWT)
 *   HasBuildAuth<"github", "get-repo">             → false (installation token)
 *   HasBuildAuth<"linear", "graphql">              → false (OAuth token)
 */
export type HasBuildAuth<
  P extends keyof typeof PROVIDERS,
  E extends EndpointKey<P>,
> = (typeof PROVIDERS)[P]["api"]["endpoints"][E] extends {
  buildAuth: (...args: any[]) => any;
}
  ? true
  : false;

// ── Provider Lookup ───────────────────────────────────────────────────────────

/** Narrow overload: literal slug → exact provider shape (no cast required). */
export function getProvider<K extends keyof typeof PROVIDERS>(
  slug: K
): ProviderShape<K>;
/** Wide overload: runtime string → union ProviderDefinition (may be undefined). */
export function getProvider(slug: string): ProviderDefinition | undefined;
export function getProvider(slug: string) {
  return (PROVIDERS as Record<string, ProviderDefinition>)[slug];
}

/** Get the default sync events for a provider. */
export function getDefaultSyncEvents(
  provider: ProviderName
): readonly string[] {
  return PROVIDERS[provider].defaultSyncEvents;
}

// ── Env Presets ───────────────────────────────────────────────────────────────

/** Returns pre-built env presets for all providers — spread into @t3-oss/env-core `extends` arrays.
 *  Optional providers declare their vars with `.optional()` schemas so builds succeed when absent. */
export function PROVIDER_ENVS(): Record<string, string>[] {
  return Object.values(PROVIDERS).map((p) => p.env);
}
