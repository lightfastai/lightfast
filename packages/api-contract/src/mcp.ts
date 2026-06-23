import { type Contract, isPublicApiContractProcedure } from "./contract";

export type McpScope =
  | "mcp:system:read"
  | "mcp:provider_routines:read"
  | "mcp:provider_routines:write"
  | "mcp:signals:read"
  | "mcp:signals:write";

export interface ExposedMcpToolPolicyEntry {
  auditEventName: string;
  description: string;
  expose: true;
  kind: "read" | "write";
  requiresBoundOrg: boolean;
  scope: McpScope;
  toolName: string;
}

export interface HiddenMcpToolPolicyEntry {
  expose: false;
  reason: string;
}

export type McpToolPolicyEntry =
  | ExposedMcpToolPolicyEntry
  | HiddenMcpToolPolicyEntry;

export type McpToolPolicy = Record<string, McpToolPolicyEntry>;

export function getContractProcedurePaths(
  contract: Record<string, unknown>
): string[] {
  const paths: string[] = [];

  function walk(node: unknown, keyPath: string[]): void {
    if (isPublicApiContractProcedure(node)) {
      paths.push(keyPath.join("."));
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    for (const key of Object.keys(node as Record<string, unknown>).sort()) {
      walk((node as Record<string, unknown>)[key], [...keyPath, key]);
    }
  }

  walk(contract, []);
  return paths.sort();
}

export const lightfastMcpToolPolicy = {
  "signals.create": {
    auditEventName: "mcp.signals.create",
    description:
      "Create a new Lightfast signal from user-provided text in the selected organization. Use this when the user wants Lightfast to remember, classify, or route a new signal.",
    expose: true,
    kind: "write",
    requiresBoundOrg: true,
    scope: "mcp:signals:write",
    toolName: "lightfast_signals_create",
  },
  "signals.get": {
    auditEventName: "mcp.signals.get",
    description:
      "Get one visible Lightfast signal by id from the selected organization, including current classification status when available.",
    expose: true,
    kind: "read",
    requiresBoundOrg: true,
    scope: "mcp:signals:read",
    toolName: "lightfast_signals_get",
  },
  "signals.list": {
    expose: false,
    reason:
      "The public SDK can list signals, but hosted MCP does not expose a broad signal-listing tool yet.",
  },
  "system.health": {
    auditEventName: "mcp.system.health",
    description:
      "Check whether the Lightfast MCP connection is authenticated and the service is reachable.",
    expose: true,
    kind: "read",
    requiresBoundOrg: false,
    scope: "mcp:system:read",
    toolName: "lightfast_system_health",
  },
} satisfies McpToolPolicy;

export type LightfastMcpToolPolicy = typeof lightfastMcpToolPolicy;
export type LightfastApiContract = Contract;
