"use client";

import {
  parseAsString,
  parseAsStringLiteral,
  parseAsArrayOf,
  useQueryStates,
} from "nuqs";
import type { RerankMode } from "@repo/console-types";

const rerankModes = ["fast", "balanced", "thorough"] as const;
const interfaceModes = ["search", "answer"] as const;

/**
 * Workspace search URL state hook
 *
 * Manages URL query parameters for the workspace search:
 * - q: Search query text
 * - mode: Rerank mode (fast/balanced/thorough)
 * - m: Interface mode (search/answer)
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
      m: parseAsStringLiteral(interfaceModes).withDefault("search"),
      sources: parseAsArrayOf(parseAsString).withDefault([]),
      types: parseAsArrayOf(parseAsString).withDefault([]),
      actors: parseAsArrayOf(parseAsString).withDefault([]),
      expanded: parseAsString.withDefault(""),
    },
    {
      history: "push",
      shallow: true,
    }
  );

  return {
    query: params.q,
    setQuery: (q: string) => setParams({ q }),
    mode: params.mode as RerankMode,
    setMode: (mode: RerankMode) => setParams({ mode }),
    interfaceMode: params.m as "search" | "answer",
    setInterfaceMode: (m: "search" | "answer") => setParams({ m }),
    sourceTypes: params.sources,
    setSourceTypes: (sources: string[]) => setParams({ sources }),
    observationTypes: params.types,
    setObservationTypes: (types: string[]) => setParams({ types }),
    actorNames: params.actors,
    setActorNames: (actors: string[]) => setParams({ actors }),
    expandedId: params.expanded,
    setExpandedId: (id: string | null) => setParams({ expanded: id ?? "" }),
    // Helper for clearing all filters
    clearFilters: () => setParams({ sources: [], types: [], actors: [] }),
  };
}
