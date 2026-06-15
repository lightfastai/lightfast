export interface ConnectorsSearch {
  connector?: string;
  error?: string;
  scope?: ConnectorOwnerScope;
}

export type ConnectorOwnerScope = "team" | "personal";

export interface NormalizedConnectorsSearch {
  connector: string | null;
  error: string | null;
  scope: ConnectorOwnerScope;
}

function nullableStringSearchParam(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function ownerScopeSearchParam(value: unknown): ConnectorOwnerScope {
  return value === "personal" ? "personal" : "team";
}

export function normalizeConnectorsSearch(
  search: Record<string, unknown>
): NormalizedConnectorsSearch {
  return {
    connector: nullableStringSearchParam(search.connector),
    error: nullableStringSearchParam(search.error),
    scope: ownerScopeSearchParam(search.scope),
  };
}

export function validateConnectorsSearch(
  search: Record<string, unknown>
): ConnectorsSearch {
  const normalized = normalizeConnectorsSearch(search);
  return {
    ...(normalized.connector ? { connector: normalized.connector } : {}),
    ...(normalized.error ? { error: normalized.error } : {}),
    ...(normalized.scope === "personal" ? { scope: normalized.scope } : {}),
  };
}
