import { parseAsString } from "nuqs";
import {
  type PersonMemberStatus,
  type PersonProvider,
  type PersonSource,
  type PersonType,
  peopleMemberStatusOptions,
  peopleProviderOptions,
  peopleSourceOptions,
  peopleTypeOptions,
} from "./people-model";

export const personMemberStatusParser = parseAsString.withDefault("");
export const personProviderParser = parseAsString.withDefault("");
export const personSourceParser = parseAsString.withDefault("");
export const personTypeParser = parseAsString.withDefault("");
export const personParser = parseAsString;
export const personQueryParser = parseAsString.withDefault("");

// "view" holds the active saved-view publicId (null when on All people).
export const peopleSavedViewParser = parseAsString;

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

export function parsePersonSources(value: string): PersonSource[] {
  return parseValues(
    value,
    peopleSourceOptions.map((option) => option.value)
  );
}

export function parsePersonMemberStatuses(value: string): PersonMemberStatus[] {
  return parseValues(
    value,
    peopleMemberStatusOptions.map((option) => option.value)
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
