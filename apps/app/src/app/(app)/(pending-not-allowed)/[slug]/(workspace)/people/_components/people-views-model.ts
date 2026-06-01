import type { AppRouterOutputs } from "@api/app";
import type { PeopleClassificationFilters } from "./people-model";
import { serializePersonValues } from "./people-search-params";

export type PeopleViewList =
  AppRouterOutputs["org"]["workspace"]["people"]["views"]["list"];
export type PeopleViewRow = PeopleViewList[number];
export type PeopleViewConfig = PeopleViewRow["config"];

export const ALL_PEOPLE_VIEW_NAME = "All people";

export interface PeopleViewParamValues {
  provider: string;
  type: string;
}

/** Serialize a saved view's config into the URL param values the page reads. */
export function viewConfigToParamValues(
  config: PeopleViewConfig
): PeopleViewParamValues {
  return {
    provider: serializePersonValues(config.filters.providers),
    type: serializePersonValues(config.filters.types),
  };
}

/** Empty param values — selecting "All people" clears all filters. */
export function allPeopleParamValues(): PeopleViewParamValues {
  return { provider: "", type: "" };
}

/** Snapshot the current toolbar selection into a view config for create. */
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
