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

export function viewConfigToParamValues(
  config: DecisionViewConfig
): DecisionViewParamValues {
  return {
    provider: serializeDecisionValues(config.filters.providers),
    status: serializeDecisionValues(config.filters.statuses),
  };
}

export function allDecisionsParamValues(): DecisionViewParamValues {
  return { provider: "", status: "" };
}

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
