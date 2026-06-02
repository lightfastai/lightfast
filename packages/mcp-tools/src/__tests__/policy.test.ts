import { apiContract, lightfastMcpToolPolicy } from "@repo/api-contract";
import { Client, InMemoryTransport, McpServer } from "@vendor/mcp";
import { describe, expect, it } from "vitest";

import {
  createLightfastMcpToolDefinitions,
  validateMcpPolicyCoverage,
} from "../policy";
import { registerLightfastMcpTools } from "../register";

describe("createLightfastMcpToolDefinitions", () => {
  it("creates stable exposed tool definitions from contract policy", () => {
    expect(() =>
      validateMcpPolicyCoverage(apiContract, lightfastMcpToolPolicy)
    ).not.toThrow();

    const tools = createLightfastMcpToolDefinitions({
      contract: apiContract,
      policy: lightfastMcpToolPolicy,
    });

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "lightfast_signals_create",
      "lightfast_signals_get",
      "lightfast_system_health",
    ]);
    expect(
      tools.find((tool) => tool.name === "lightfast_signals_create")
    ).toMatchObject({
      contractPath: "signals.create",
      requiredScope: "mcp:signals:write",
      kind: "write",
      requiresBoundOrg: true,
    });
  });

  it("registers policy-derived tools on an MCP server", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerLightfastMcpTools(server, {
      contract: apiContract,
      execute: async ({ contractPath }) => ({ contractPath }),
      policy: lightfastMcpToolPolicy,
    });

    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "lightfast_signals_create",
      "lightfast_signals_get",
      "lightfast_system_health",
    ]);

    await client.close();
    await server.close();
  });
});
