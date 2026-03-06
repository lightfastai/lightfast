import { z } from "zod";
import type { ProviderDefinition, EventDefinition, ActionEventDef } from "./define.js";
import type { GitHubConfig } from "./providers/github/auth.js";
import { githubAccountInfoSchema } from "./providers/github/auth.js";
import type { VercelConfig } from "./providers/vercel/auth.js";
import { vercelAccountInfoSchema } from "./providers/vercel/auth.js";
import type { LinearConfig } from "./providers/linear/auth.js";
import { linearAccountInfoSchema } from "./providers/linear/auth.js";
import type { SentryConfig } from "./providers/sentry/auth.js";
import { sentryAccountInfoSchema } from "./providers/sentry/auth.js";
import { github } from "./providers/github/index.js";
import { vercel } from "./providers/vercel/index.js";
import { linear } from "./providers/linear/index.js";
import { sentry } from "./providers/sentry/index.js";

// ── The Registry ──────────────────────────────────────────────────────────────

// Maps each provider to its concrete config type — enables type-safe satisfies without `any`.
// Adding a provider = add entry here + add to PROVIDERS below.
interface ProviderConfigMap {
  readonly github: GitHubConfig;
  readonly vercel: VercelConfig;
  readonly linear: LinearConfig;
  readonly sentry: SentryConfig;
}

export const PROVIDERS = {
  github, vercel, linear, sentry,
} as const satisfies {
  readonly [K in keyof ProviderConfigMap]: ProviderDefinition<ProviderConfigMap[K]>;
};

export type ProviderName = keyof typeof PROVIDERS;

// ── SourceType — derived from PROVIDERS ──────────────────────────────────────

/** The canonical source type union, derived from the provider registry. */
export type SourceType = ProviderName;

/** Zod enum schema derived from provider keys — use at API/DB boundaries. */
export const sourceTypeSchema = z.enum(
  Object.keys(PROVIDERS) as [ProviderName, ...ProviderName[]],
);

// ── Type-Level Event Key Derivation ──────────────────────────────────────────

/**
 * Extract concrete action keys from an EventDefinition.
 * Returns the actions record if it has specific literal keys (not just `string`).
 * Returns `never` for simple events without actions.
 */
type ActionsOf<E> = E extends ActionEventDef<infer _S, infer A>
  ? string extends keyof A ? never : A
  : never;

/** Derive event keys for a single provider from its events map */
type DeriveProviderKeys<P extends ProviderName> = {
  [E in keyof (typeof PROVIDERS)[P]["events"] & string]:
    [ActionsOf<(typeof PROVIDERS)[P]["events"][E]>] extends [never]
      ? `${P}:${E}`
      : `${P}:${E}.${keyof ActionsOf<(typeof PROVIDERS)[P]["events"][E]> & string}`
}[keyof (typeof PROVIDERS)[P]["events"] & string];

/** All valid event keys — derived from provider definitions at the type level */
export type EventKey = { [P in ProviderName]: DeriveProviderKeys<P> }[ProviderName];

// ── Runtime Event Registry Derivation ────────────────────────────────────────

export interface EventRegistryEntry {
  source: SourceType;
  label: string;
  weight: number;
  externalKeys: readonly string[];
  category: string;
}

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

// ── Provider Lookup ───────────────────────────────────────────────────────────

export function getProvider<N extends ProviderName>(name: N): (typeof PROVIDERS)[N];
export function getProvider(name: string): ProviderDefinition | undefined;
export function getProvider(name: string) {
  return (PROVIDERS as Record<string, ProviderDefinition>)[name];
}

// ── Account Info Schema ───────────────────────────────────────────────────────

// Adding a provider = add entry to ProviderConfigMap above + PROVIDERS + this tuple.
export const providerAccountInfoSchema = z.discriminatedUnion("sourceType", [
  githubAccountInfoSchema,
  vercelAccountInfoSchema,
  linearAccountInfoSchema,
  sentryAccountInfoSchema,
]);

export type ProviderAccountInfo = z.infer<typeof providerAccountInfoSchema>;

/** Get the default sync events for a provider. */
export function getDefaultSyncEvents(provider: ProviderName): readonly string[] {
  return PROVIDERS[provider].defaultSyncEvents;
}

// ── Env Schemas ───────────────────────────────────────────────────────────────

/** Merged env schemas from all providers — for gateway env.ts server block */
export const PROVIDER_ENV_SCHEMAS = Object.fromEntries(
  Object.values(PROVIDERS).flatMap((p) => Object.entries(p.envSchema)),
);
