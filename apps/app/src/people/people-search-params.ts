import {
  type PersonProvider,
  type PersonType,
  peopleProviderOptions,
  peopleTypeOptions,
} from "./people-model";

export interface PeopleSearch {
  peopleQuery?: string;
  person?: string;
  provider?: string;
  type?: string;
  view?: string;
}

export interface NormalizedPeopleSearch {
  peopleQuery: string;
  person: string | null;
  provider: string;
  type: string;
  view: string | null;
}

function stringSearchParam(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableStringSearchParam(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizePeopleSearch(
  search: Record<string, unknown>
): NormalizedPeopleSearch {
  return {
    peopleQuery: stringSearchParam(search.peopleQuery),
    person: nullableStringSearchParam(search.person),
    provider: stringSearchParam(search.provider),
    type: stringSearchParam(search.type),
    view: nullableStringSearchParam(search.view),
  };
}

export function validatePeopleSearch(
  search: Record<string, unknown>
): PeopleSearch {
  const normalized = normalizePeopleSearch(search);
  return {
    ...(normalized.peopleQuery ? { peopleQuery: normalized.peopleQuery } : {}),
    ...(normalized.person ? { person: normalized.person } : {}),
    ...(normalized.provider ? { provider: normalized.provider } : {}),
    ...(normalized.type ? { type: normalized.type } : {}),
    ...(normalized.view ? { view: normalized.view } : {}),
  };
}

function parseValues<T extends string>(
  value: string,
  allowedValues: readonly T[]
): T[] {
  const allowed = new Set(allowedValues);
  const seen = new Set<T>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is T => allowed.has(item as T))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

export function parsePersonProviders(value: string): PersonProvider[] {
  return parseValues(
    value,
    peopleProviderOptions.map((option) => option.value)
  );
}

export function parsePersonTypes(value: string): PersonType[] {
  return parseValues(
    value,
    peopleTypeOptions.map((option) => option.value)
  );
}

export function serializePersonValues(values: readonly string[]) {
  return values.length > 0 ? values.join(",") : "";
}

export function togglePersonValue<T extends string>(
  values: readonly T[],
  value: T
): T[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}
