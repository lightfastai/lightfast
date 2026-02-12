"use client";

import {
  parseAsString,
  parseAsStringLiteral,
  parseAsArrayOf,
  parseAsInteger,
  parseAsBoolean,
  useQueryStates,
} from "nuqs";
import type { RerankMode } from "@repo/console-types";

const rerankModes = ["fast", "balanced", "thorough"] as const;
const agePresets = ["1h", "6h", "24h", "72h", "7d", "30d", "none"] as const;
const viewTabs = ["list", "json"] as const;

/**
 * Workspace search URL state hook
 *
 * Manages URL query parameters for the workspace search:
 * - q: Search query text
 * - mode: Rerank mode (fast/balanced/thorough)
 * - sources: Source type filters
 * - types: Observation type filters
 * - actors: Actor name filters
 * - expanded: Currently expanded result ID
 */
export function useWorkspaceSearchParams(initialQuery = "") {
  const [params, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(initialQuery),
      mode: parseAsStringLiteral(rerankModes).withDefault("balanced"),
      sources: parseAsArrayOf(parseAsString).withDefault([]),
      types: parseAsArrayOf(parseAsString).withDefault([]),
      actors: parseAsArrayOf(parseAsString).withDefault([]),
      expanded: parseAsString.withDefault(""),
      limit: parseAsInteger.withDefault(20),
      offset: parseAsInteger.withDefault(0),
      ctx: parseAsBoolean.withDefault(true),
      hl: parseAsBoolean.withDefault(true),
      age: parseAsStringLiteral(agePresets).withDefault("none"),
      view: parseAsStringLiteral(viewTabs).withDefault("list"),
    },
    {
      history: "replace",
      shallow: true,
    }
  );

  return {
    query: params.q,
    setQuery: (q: string) => setParams({ q }),
    mode: params.mode as RerankMode,
    setMode: (mode: RerankMode) => setParams({ mode }),
    sourceTypes: params.sources,
    setSourceTypes: (sources: string[]) => setParams({ sources }),
    observationTypes: params.types,
    setObservationTypes: (types: string[]) => setParams({ types }),
    actorNames: params.actors,
    setActorNames: (actors: string[]) => setParams({ actors }),
    expandedId: params.expanded,
    setExpandedId: (id: string | null) => setParams({ expanded: id ?? "" }),
    limit: params.limit,
    setLimit: (v: number) => setParams({ limit: v }),
    offset: params.offset,
    setOffset: (v: number) => setParams({ offset: v }),
    includeContext: params.ctx,
    setIncludeContext: (v: boolean) => setParams({ ctx: v }),
    includeHighlights: params.hl,
    setIncludeHighlights: (v: boolean) => setParams({ hl: v }),
    agePreset: params.age as typeof agePresets[number],
    setAgePreset: (v: typeof agePresets[number]) => setParams({ age: v }),
    activeTab: params.view as typeof viewTabs[number],
    setActiveTab: (v: typeof viewTabs[number]) => setParams({ view: v }),
    // Helper for clearing all filters
    clearFilters: () => setParams({
      sources: [],
      types: [],
      actors: [],
      age: "none",
    }),
  };
}
