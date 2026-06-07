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

export const TEAM_MEMBERS_PRESET_ID = "team_members";

const teamMembersPresetFilters: PeopleClassificationFilters = {
  memberStatuses: ["active"],
  providers: [],
  sources: ["team_member", "mixed"],
  types: [],
};

function hasSameValues<T extends string>(
  actual: readonly T[],
  expected: readonly T[]
) {
  const actualValues = new Set(actual);
  const expectedValues = new Set(expected);
  if (actualValues.size !== expectedValues.size) {
    return false;
  }
  return [...actualValues].every((value) => expectedValues.has(value));
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

export function teamMembersParamValues(): PeopleViewParamValues {
  return viewConfigToParamValues(selectionToConfig(teamMembersPresetFilters));
}

export function isTeamMembersPresetFilters(
  filters: PeopleClassificationFilters
) {
  return (
    hasSameValues(
      filters.memberStatuses,
      teamMembersPresetFilters.memberStatuses
    ) &&
    hasSameValues(filters.providers, teamMembersPresetFilters.providers) &&
    hasSameValues(filters.sources, teamMembersPresetFilters.sources) &&
    hasSameValues(filters.types, teamMembersPresetFilters.types)
  );
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
