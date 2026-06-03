import { parseAsString } from "nuqs";
import {
  type DecisionProvider,
  type DecisionStatus,
  decisionProviderOptions,
  decisionStatusOptions,
} from "./decisions-model";

export const decisionProviderParser = parseAsString.withDefault("");
export const decisionStatusParser = parseAsString.withDefault("");
export const decisionQueryParser = parseAsString.withDefault("");
// "decision" holds the expanded row publicId (null when collapsed).
export const decisionParser = parseAsString;

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

export function parseDecisionProviders(value: string): DecisionProvider[] {
  return parseValues(
    value,
    decisionProviderOptions.map((option) => option.value)
  );
}

export function parseDecisionStatuses(value: string): DecisionStatus[] {
  return parseValues(
    value,
    decisionStatusOptions.map((option) => option.value)
  );
}

export function serializeDecisionValues(values: readonly string[]) {
  return values.length > 0 ? values.join(",") : "";
}

export function toggleDecisionValue<T extends string>(
  values: readonly T[],
  value: T
): T[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}
