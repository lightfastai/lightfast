export interface DeveloperConnectionsSearch {
  connection?: string;
  error?: string;
}

export interface NormalizedDeveloperConnectionsSearch {
  connection: string | null;
  error: string | null;
}

function nullableStringSearchParam(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeDeveloperConnectionsSearch(
  search: Record<string, unknown>
): NormalizedDeveloperConnectionsSearch {
  return {
    connection: nullableStringSearchParam(search.connection),
    error: nullableStringSearchParam(search.error),
  };
}

export function validateDeveloperConnectionsSearch(
  search: Record<string, unknown>
): DeveloperConnectionsSearch {
  const normalized = normalizeDeveloperConnectionsSearch(search);
  return {
    ...(normalized.connection ? { connection: normalized.connection } : {}),
    ...(normalized.error ? { error: normalized.error } : {}),
  };
}
