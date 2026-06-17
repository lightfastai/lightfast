import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("org MCP connection query helpers", () => {
  it("centralizes org MCP settings query keys and server function calls", () => {
    const querySource = source(
      "src/org/settings/mcp/mcp-connections-queries.ts"
    );

    expect(querySource).toContain('@api/app/tanstack/mcp-connections"');
    expect(querySource).toContain("orgMcpConnectionQueryKeys");
    expect(querySource).toContain("orgMcpConnectionsQueryOptions");
    expect(querySource).toContain("revokeOrgMcpConnectionMutationOptions");
    expect(querySource).not.toContain("useTRPC");
  });

  it("moves the org MCP settings UI off tRPC", () => {
    const clientSource = source(
      "src/org/settings/mcp/mcp-connections-client.tsx"
    );

    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain("org.settings.mcpConnections");
    expect(clientSource).toContain("orgMcpConnectionsQueryOptions");
    expect(clientSource).toContain("revokeOrgMcpConnectionMutationOptions");
  });
});
