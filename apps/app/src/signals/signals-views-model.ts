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

export function allSignalsParamValues(): SignalViewParamValues {
  return { disposition: "", kind: "", people: "all", priority: "" };
}

export function selectionToConfig(
  filters: SignalClassificationFilters
): SignalViewConfig {
  return {
    filters: {
      dispositions: filters.dispositions,
      kinds: filters.kinds,
      peopleRouted: filters.peopleRouted,
      priorities: filters.priorities,
    },
  };
}
