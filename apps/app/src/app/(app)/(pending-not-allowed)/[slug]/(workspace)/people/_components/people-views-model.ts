import type { AppRouterOutputs } from "@api/app";
import type { PeopleClassificationFilters } from "./people-model";
import { serializePersonValues } from "./people-search-params";

export type PeopleViewList =
  AppRouterOutputs["org"]["workspace"]["people"]["views"]["list"];
export type PeopleViewRow = PeopleViewList[number];
export type PeopleViewConfig = PeopleViewRow["config"];

export interface PeopleViewParamValues {
  memberStatus: string;
  provider: string;
  source: string;
  type: string;
}

/** Serialize a saved view's config into the URL param values the page reads. */
export function viewConfigToParamValues(
  config: PeopleViewConfig
): PeopleViewParamValues {
  const filters = config.filters;
  return {
    memberStatus: serializePersonValues(filters.memberStatuses ?? []),
    provider: serializePersonValues(filters.providers ?? []),
    source: serializePersonValues(filters.sources ?? []),
    type: serializePersonValues(filters.types ?? []),
  };
}

/** Empty param values — selecting "All people" clears all filters. */
export function allPeopleParamValues(): PeopleViewParamValues {
  return { memberStatus: "", provider: "", source: "", type: "" };
}

/** Snapshot the current toolbar selection into a view config for create. */
export function selectionToConfig(
  filters: PeopleClassificationFilters
): PeopleViewConfig {
  return {
    filters: {
      memberStatuses: filters.memberStatuses,
      providers: filters.providers,
      sources: filters.sources,
      types: filters.types,
    },
  };
}
