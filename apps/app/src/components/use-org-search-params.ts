"use client";

import type { SearchMode } from "@repo/app-validation";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

const searchModes = ["fast", "balanced"] as const;
const agePresets = ["1h", "6h", "24h", "72h", "7d", "30d", "none"] as const;
const viewTabs = ["list", "json"] as const;

/**
 * Org search URL state hook
 *
 * Manages URL query parameters for the org search:
 * - q: Search query text
 * - mode: Search mode (fast/balanced)
 * - sources: Source provider filters
 * - types: Entity type filters
 * - expanded: Currently expanded result ID
 */
export function useOrgSearchParams(initialQuery = "") {
  const [params, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(initialQuery),
      mode: parseAsStringLiteral(searchModes).withDefault("balanced"),
      sources: parseAsArrayOf(parseAsString).withDefault([]),
      types: parseAsArrayOf(parseAsString).withDefault([]),
      expanded: parseAsString.withDefault(""),
      limit: parseAsInteger.withDefault(20),
      offset: parseAsInteger.withDefault(0),
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
    mode: params.mode as SearchMode,
    setMode: (mode: SearchMode) => setParams({ mode }),
    sources: params.sources,
    setSources: (sources: string[]) => setParams({ sources }),
    types: params.types,
    setTypes: (types: string[]) => setParams({ types }),
    expandedId: params.expanded,
    setExpandedId: (id: string | null) => setParams({ expanded: id ?? "" }),
    limit: params.limit,
    setLimit: (v: number) => setParams({ limit: v }),
    offset: params.offset,
    setOffset: (v: number) => setParams({ offset: v }),
    agePreset: params.age as (typeof agePresets)[number],
    setAgePreset: (v: (typeof agePresets)[number]) => setParams({ age: v }),
    activeTab: params.view as (typeof viewTabs)[number],
    setActiveTab: (v: (typeof viewTabs)[number]) => setParams({ view: v }),
    // Helper for clearing all filters
    clearFilters: () =>
      setParams({
        sources: [],
        types: [],
        age: "none",
      }),
  };
}
