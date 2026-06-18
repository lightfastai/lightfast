import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("org MCP connection settings data access", () => {
  it("keeps the org MCP settings query ownership in the client", () => {
    const clientSource = source(
      "src/org/settings/mcp/mcp-connections-client.tsx"
    );
    const queryPath = "src/org/settings/mcp/mcp-connections-queries.ts";

    expect(existsSync(resolve(appRoot, queryPath))).toBe(false);
    expect(clientSource).toContain('@api/app/tanstack/mcp-connections"');
    expect(clientSource).toContain("listOrgMcpConnections");
    expect(clientSource).toContain("revokeOrgMcpConnection");
    expect(clientSource).toContain('["org-mcp-connections", "list"]');
    expect(clientSource).not.toContain("useTRPC");
    expect(clientSource).not.toContain("org.settings.mcpConnections");
    expect(clientSource).not.toContain("mcp-connections-queries");
    expect(clientSource).not.toContain("orgMcpConnectionsQueryOptions");
    expect(clientSource).not.toContain("revokeOrgMcpConnectionMutationOptions");
  });
});
