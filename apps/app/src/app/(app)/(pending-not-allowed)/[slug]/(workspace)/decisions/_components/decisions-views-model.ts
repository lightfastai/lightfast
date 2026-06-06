import type { AppRouterOutputs } from "@api/app";
import type { DecisionFilters } from "./decisions-model";
import { serializeDecisionValues } from "./decisions-search-params";

export type DecisionViewList =
  AppRouterOutputs["org"]["workspace"]["decisions"]["views"]["list"];
export type DecisionViewRow = DecisionViewList[number];
export type DecisionViewConfig = DecisionViewRow["config"];

export interface DecisionViewParamValues {
  provider: string;
  status: string;
}

/** Serialize a saved view's config into the URL param values the page reads. */
export function viewConfigToParamValues(
  config: DecisionViewConfig
): DecisionViewParamValues {
  return {
    provider: serializeDecisionValues(config.filters.providers),
    status: serializeDecisionValues(config.filters.statuses),
  };
}

/** Empty param values — selecting "All decisions" clears all filters. */
export function allDecisionsParamValues(): DecisionViewParamValues {
  return { provider: "", status: "" };
}

/** Snapshot the current toolbar selection into a view config for create. */
export function selectionToConfig(
  filters: DecisionFilters
): DecisionViewConfig {
  return {
    filters: {
      providers: filters.providers,
      statuses: filters.statuses,
    },
  };
}
