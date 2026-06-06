export interface ConnectorsSearch {
  connector?: string;
  error?: string;
}

export interface NormalizedConnectorsSearch {
  connector: string | null;
  error: string | null;
}

function nullableStringSearchParam(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeConnectorsSearch(
  search: Record<string, unknown>
): NormalizedConnectorsSearch {
  return {
    connector: nullableStringSearchParam(search.connector),
    error: nullableStringSearchParam(search.error),
  };
}

export function validateConnectorsSearch(
  search: Record<string, unknown>
): ConnectorsSearch {
  const normalized = normalizeConnectorsSearch(search);
  return {
    ...(normalized.connector ? { connector: normalized.connector } : {}),
    ...(normalized.error ? { error: normalized.error } : {}),
  };
}
