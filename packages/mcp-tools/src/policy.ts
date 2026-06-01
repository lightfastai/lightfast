import {
  type ExposedMcpToolPolicyEntry,
  getContractProcedurePaths,
  type McpToolPolicy,
} from "@repo/api-contract";

export interface LightfastMcpToolDefinition extends ExposedMcpToolPolicyEntry {
  contractPath: string;
  inputSchema?: unknown;
  name: string;
  outputSchema?: unknown;
  requiredScope: ExposedMcpToolPolicyEntry["scope"];
}

function getNodeAtPath(root: Record<string, unknown>, path: string): unknown {
  let node: unknown = root;
  for (const segment of path.split(".")) {
    if (!node || typeof node !== "object") {
      return;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

function getOrpcSchemas(node: unknown): {
  inputSchema?: unknown;
  outputSchema?: unknown;
} {
  const def = (
    node as {
      "~orpc"?: {
        inputSchema?: unknown;
        outputSchema?: unknown;
      };
    }
  )["~orpc"];

  return {
    inputSchema: def?.inputSchema,
    outputSchema: def?.outputSchema,
  };
}

export function validateMcpPolicyCoverage(
  contract: Record<string, unknown>,
  policy: McpToolPolicy
): void {
  const paths = getContractProcedurePaths(contract);
  const policyPaths = Object.keys(policy).sort();
  if (JSON.stringify(paths) !== JSON.stringify(policyPaths)) {
    throw new Error(
      `MCP policy coverage mismatch. contract=${paths.join(",")} policy=${policyPaths.join(",")}`
    );
  }
}

export function createLightfastMcpToolDefinitions(input: {
  contract: Record<string, unknown>;
  policy: McpToolPolicy;
}): LightfastMcpToolDefinition[] {
  validateMcpPolicyCoverage(input.contract, input.policy);

  return Object.entries(input.policy)
    .flatMap(([contractPath, entry]) => {
      if (!entry.expose) {
        return [];
      }
      const schemas = getOrpcSchemas(
        getNodeAtPath(input.contract, contractPath)
      );
      return [
        {
          ...entry,
          ...schemas,
          contractPath,
          name: entry.toolName,
          requiredScope: entry.scope,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
