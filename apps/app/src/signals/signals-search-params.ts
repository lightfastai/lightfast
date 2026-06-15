import {
  type SignalDisposition,
  type SignalKind,
  type SignalPriority,
  signalDispositionOptions,
  signalKindOptions,
  signalPriorityOptions,
} from "./signals-model";

export interface SignalsSearch {
  disposition?: string;
  kind?: string;
  people?: "all" | "routed";
  priority?: string;
  signal?: string;
  view?: string;
}

export interface NormalizedSignalsSearch {
  disposition: string;
  kind: string;
  people: "all" | "routed";
  priority: string;
  signal: string | null;
  view: string | null;
}

export type SignalsSearchKey = keyof NormalizedSignalsSearch;

function stringSearchParam(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableStringSearchParam(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeSignalsSearch(
  search: Record<string, unknown>
): NormalizedSignalsSearch {
  return {
    disposition: stringSearchParam(search.disposition),
    kind: stringSearchParam(search.kind),
    people: search.people === "routed" ? "routed" : "all",
    priority: stringSearchParam(search.priority),
    signal: nullableStringSearchParam(search.signal),
    view: nullableStringSearchParam(search.view),
  };
}

export function validateSignalsSearch(
  search: Record<string, unknown>
): SignalsSearch {
  const normalized = normalizeSignalsSearch(search);
  return {
    ...(normalized.disposition ? { disposition: normalized.disposition } : {}),
    ...(normalized.kind ? { kind: normalized.kind } : {}),
    ...(normalized.people === "routed" ? { people: normalized.people } : {}),
    ...(normalized.priority ? { priority: normalized.priority } : {}),
    ...(normalized.signal ? { signal: normalized.signal } : {}),
    ...(normalized.view ? { view: normalized.view } : {}),
  };
}

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
