import {
  type DecisionProvider,
  type DecisionStatus,
  decisionProviderOptions,
  decisionStatusOptions,
} from "./decisions-model";

export interface DecisionsSearch {
  decision?: string;
  provider?: string;
  q?: string;
  status?: string;
  view?: string;
}

export interface NormalizedDecisionsSearch {
  decision: string | null;
  provider: string;
  q: string;
  status: string;
  view: string | null;
}

function stringSearchParam(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableStringSearchParam(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeDecisionsSearch(
  search: Record<string, unknown>
): NormalizedDecisionsSearch {
  return {
    decision: nullableStringSearchParam(search.decision),
    provider: stringSearchParam(search.provider),
    q: stringSearchParam(search.q),
    status: stringSearchParam(search.status),
    view: nullableStringSearchParam(search.view),
  };
}

export function validateDecisionsSearch(
  search: Record<string, unknown>
): DecisionsSearch {
  const normalized = normalizeDecisionsSearch(search);
  return {
    ...(normalized.decision ? { decision: normalized.decision } : {}),
    ...(normalized.provider ? { provider: normalized.provider } : {}),
    ...(normalized.q ? { q: normalized.q } : {}),
    ...(normalized.status ? { status: normalized.status } : {}),
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
