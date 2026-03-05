import type { ProviderDefinition } from "./define.js";
import type { SourceType } from "@repo/console-validation";
import { github } from "./providers/github.js";
import { vercel } from "./providers/vercel.js";
import { linear } from "./providers/linear.js";
import { sentry } from "./providers/sentry.js";

// ── The Registry ──────────────────────────────────────────────────────────────

export const PROVIDERS = { github, vercel, linear, sentry } as const;

export type ProviderName = keyof typeof PROVIDERS;

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
) as Record<
  SourceType,
  { name: string; description: string; events: Record<string, { label: string; description: string; type: string }> }
>;

export const EVENT_CATEGORIES = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [key, p.categories]),
) as Record<SourceType, Record<string, { label: string; description: string; type: string }>>;

export const WEBHOOK_EVENT_TYPES: Record<SourceType, string[]> = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, p]) => [key, Object.keys(p.categories)]),
) as Record<SourceType, string[]>;

export function getEventWeight(source: SourceType, eventType: string): number {
  const eventDef = PROVIDERS[source].events[eventType];
  return eventDef?.weight ?? 35;
}
