import { parseAsString, parseAsStringLiteral } from "nuqs";
import {
  type SignalDisposition,
  type SignalKind,
  type SignalPriority,
  signalDispositionOptions,
  signalKindOptions,
  signalPriorityOptions,
} from "./signals-model";

export const signalDispositionParser = parseAsString.withDefault("");
export const signalKindParser = parseAsString.withDefault("");
export const signalPeopleParser = parseAsStringLiteral([
  "all",
  "routed",
] as const).withDefault("all");
export const signalPriorityParser = parseAsString.withDefault("");

// "view" now holds the active saved-view publicId (null when on All signals).
export const signalSavedViewParser = parseAsString;

export const signalParser = parseAsString;

function parseSignalValues<T extends string>(
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

export function parseSignalDispositions(value: string): SignalDisposition[] {
  return parseSignalValues(
    value,
    signalDispositionOptions.map((option) => option.value)
  );
}

export function parseSignalKinds(value: string): SignalKind[] {
  return parseSignalValues(
    value,
    signalKindOptions.map((option) => option.value)
  );
}

export function parseSignalPriorities(value: string): SignalPriority[] {
  return parseSignalValues(
    value,
    signalPriorityOptions.map((option) => option.value)
  );
}

export function serializeSignalValues(values: readonly string[]) {
  return values.length > 0 ? values.join(",") : "";
}

export function toggleSignalValue<T extends string>(
  values: readonly T[],
  value: T
): T[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}
