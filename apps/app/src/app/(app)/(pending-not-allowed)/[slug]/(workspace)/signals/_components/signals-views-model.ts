import type { AppRouterOutputs } from "@api/app";
import type {
  SignalClassificationFilters,
  SignalView as SignalLayout,
} from "./signals-model";
import { serializeSignalValues } from "./signals-search-params";

export type SignalViewList =
  AppRouterOutputs["org"]["workspace"]["signals"]["views"]["list"];
export type SignalViewRow = SignalViewList[number];
export type SignalViewConfig = SignalViewRow["config"];

export const ALL_SIGNALS_VIEW_NAME = "All signals";

export interface SignalViewParamValues {
  disposition: string;
  kind: string;
  layout: SignalLayout;
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
    layout: config.layout,
    people: config.filters.peopleRouted ? "routed" : "all",
    priority: serializeSignalValues(config.filters.priorities),
  };
}

/** Empty param values — selecting "All signals" keeps the current layout. */
export function allSignalsParamValues(
  layout: SignalLayout
): SignalViewParamValues {
  return { disposition: "", kind: "", layout, people: "all", priority: "" };
}

/** Snapshot the current toolbar selection into a view config for create. */
export function selectionToConfig(
  filters: SignalClassificationFilters,
  layout: SignalLayout
): SignalViewConfig {
  return {
    filters: {
      kinds: filters.kinds,
      priorities: filters.priorities,
      dispositions: filters.dispositions,
      peopleRouted: filters.peopleRouted,
    },
    layout,
  };
}
