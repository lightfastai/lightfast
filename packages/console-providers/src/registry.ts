import { z } from "zod";
import type { ProviderDefinition, EventDefinition, ActionDef, ActionEventDef } from "./define.js";
import { github } from "./providers/github.js";
import { vercel } from "./providers/vercel.js";
import { linear } from "./providers/linear.js";
import { sentry } from "./providers/sentry.js";

// ── The Registry ──────────────────────────────────────────────────────────────

export const PROVIDERS = { github, vercel, linear, sentry } as const;

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

interface EventRegistryEntry {
  source: SourceType;
  label: string;
  weight: number;
  externalKeys: readonly string[];
  category: string;
}

function deriveEventRegistry(): Record<string, EventRegistryEntry> {
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

  return registry;
}

/** Derived event registry — single source of truth is the provider definitions */
export const EVENT_REGISTRY: Record<EventKey, EventRegistryEntry> =
  deriveEventRegistry() as Record<EventKey, EventRegistryEntry>;

// ── Derived Per-Provider Event Lists ─────────────────────────────────────────

type CategoryKeys<P extends ProviderName> = keyof (typeof PROVIDERS)[P]["categories"] & string;

export const ALL_GITHUB_EVENTS = Object.keys(PROVIDERS.github.categories) as CategoryKeys<"github">[];
export const ALL_VERCEL_EVENTS = Object.keys(PROVIDERS.vercel.categories) as CategoryKeys<"vercel">[];
export const ALL_SENTRY_EVENTS = Object.keys(PROVIDERS.sentry.categories) as CategoryKeys<"sentry">[];
export const ALL_LINEAR_EVENTS = Object.keys(PROVIDERS.linear.categories) as CategoryKeys<"linear">[];

// ── Derived Exports ───────────────────────────────────────────────────────────

export const PROVIDER_NAMES = Object.keys(PROVIDERS) as ProviderName[];

export function getProvider(name: string): ProviderDefinition | undefined {
  return PROVIDERS[name as ProviderName] as unknown as ProviderDefinition | undefined;
}

/** Backwards-compatible: provider metadata for UI */
export const PROVIDER_REGISTRY = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [
    key,
    { name: p.displayName, description: p.description, events: p.categories },
  ]),
) as unknown as Record<
  SourceType,
  { name: string; description: string; events: Record<string, { label: string; description: string; type: string }> }
>;

export const EVENT_CATEGORIES = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [key, p.categories]),
) as unknown as Record<SourceType, Record<string, { label: string; description: string; type: string }>>;

export const WEBHOOK_EVENT_TYPES: Record<SourceType, string[]> = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [key, Object.keys(p.categories)]),
) as unknown as Record<SourceType, string[]>;

/** Derived from PROVIDERS — automatically includes any new provider added to the registry */
export const providerAccountInfoSchema = z.discriminatedUnion(
  "sourceType",
  Object.values(PROVIDERS).map((p) => p.accountInfoSchema) as [z.ZodObject, ...z.ZodObject[]],
);

export type ProviderAccountInfo = z.infer<typeof providerAccountInfoSchema>;

/** Merged env schemas from all providers — for gateway env.ts server block */
export const PROVIDER_ENV_SCHEMAS = Object.fromEntries(
  Object.values(PROVIDERS).flatMap((p) => Object.entries(p.envSchema)),
);
