import { describe, expect, it } from "vitest";

import { apiContract } from "../contract";
import {
  getContractProcedurePaths,
  lightfastMcpToolPolicy,
  type McpScope,
  type McpToolPolicyEntry,
} from "../mcp";

describe("lightfastMcpToolPolicy", () => {
  it("declares an MCP policy decision for every public API procedure", () => {
    expect(getContractProcedurePaths(apiContract)).toEqual([
      "signals.create",
      "signals.get",
      "system.health",
    ]);
    expect(Object.keys(lightfastMcpToolPolicy).sort()).toEqual([
      "signals.create",
      "signals.get",
      "system.health",
    ]);
  });

  it("keeps existing MCP tool names stable", () => {
    expect(lightfastMcpToolPolicy["system.health"]).toMatchObject({
      expose: true,
      toolName: "lightfast_system_health",
      scope: "mcp:system:read",
      kind: "read",
      requiresBoundOrg: false,
    } satisfies Partial<McpToolPolicyEntry>);
    expect(lightfastMcpToolPolicy["signals.create"]).toMatchObject({
      expose: true,
      toolName: "lightfast_signals_create",
      scope: "mcp:signals:write",
      kind: "write",
      requiresBoundOrg: true,
    } satisfies Partial<McpToolPolicyEntry>);
    expect(lightfastMcpToolPolicy["signals.get"]).toMatchObject({
      expose: true,
      toolName: "lightfast_signals_get",
      scope: "mcp:signals:read",
      kind: "read",
      requiresBoundOrg: true,
    } satisfies Partial<McpToolPolicyEntry>);
  });

  it("only counts plain public API contract procedures", () => {
    expect(apiContract.signals.create.route.path).toBe("/signals");
    expect(getContractProcedurePaths({ misc: { value: true } })).toEqual([]);
  });

  it("includes provider routine MCP scopes in the public scope type", () => {
    const scopes = [
      "mcp:provider_routines:read",
      "mcp:provider_routines:write",
    ] satisfies McpScope[];

    expect(scopes).toEqual([
      "mcp:provider_routines:read",
      "mcp:provider_routines:write",
    ]);
  });
});
