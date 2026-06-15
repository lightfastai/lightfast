import type { AppRouterOutputs } from "@api/app";
import type { SignalClassificationFilters } from "./signals-model";
import { serializeSignalValues } from "./signals-search-params";

export type SignalViewList =
  AppRouterOutputs["org"]["workspace"]["signals"]["views"]["list"];
export type SignalViewRow = SignalViewList[number];
export type SignalViewConfig = SignalViewRow["config"];

export interface SignalViewParamValues {
  disposition: string;
  kind: string;
  people: "all" | "routed";
  priority: string;
}

/** Serialize a saved view's config into the URL param values the page reads. */
export function viewConfigToParamValues(
  config: SignalViewConfig
): SignalViewParamValues {
  return {
    disposition: serializeSignalValues(config.filters.dispositions),
    kind: serializeSignalValues(config.filters.kinds),
    people: config.filters.peopleRouted ? "routed" : "all",
    priority: serializeSignalValues(config.filters.priorities),
  };
}

/** Empty param values — selecting "All signals" clears all filters. */
export function allSignalsParamValues(): SignalViewParamValues {
  return { disposition: "", kind: "", people: "all", priority: "" };
}

/** Snapshot the current toolbar selection into a view config for create. */
export function selectionToConfig(
  filters: SignalClassificationFilters
): SignalViewConfig {
  return {
    filters: {
      kinds: filters.kinds,
      priorities: filters.priorities,
      dispositions: filters.dispositions,
      peopleRouted: filters.peopleRouted,
    },
  };
}
