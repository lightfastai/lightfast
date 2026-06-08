import type { AppRouterOutputs } from "@api/app";
import type { PeopleClassificationFilters } from "./people-model";
import { serializePersonValues } from "./people-search-params";

export type PeopleViewList =
  AppRouterOutputs["org"]["workspace"]["people"]["views"]["list"];
export type PeopleViewRow = PeopleViewList[number];
export type PeopleViewConfig = PeopleViewRow["config"];

export interface PeopleViewParamValues {
  provider: string;
  type: string;
}

export function viewConfigToParamValues(
  config: PeopleViewConfig
): PeopleViewParamValues {
  return {
    provider: serializePersonValues(config.filters.providers),
    type: serializePersonValues(config.filters.types),
  };
}

export function allPeopleParamValues(): PeopleViewParamValues {
  return { provider: "", type: "" };
}

export function selectionToConfig(
  filters: PeopleClassificationFilters
): PeopleViewConfig {
  return {
    filters: {
      providers: filters.providers,
      types: filters.types,
    },
  };
}
