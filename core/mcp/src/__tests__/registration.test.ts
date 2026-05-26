import { apiContract } from "@repo/api-contract";
import { McpServer, registerContractTools } from "@vendor/mcp";
import { describe, expect, it } from "vitest";

describe("MCP tool registration", () => {
  it("registers lightfast_system_health from the contract", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });

    const client = {
      signals: {
        create: async () => ({
          id: "signal_123e4567-e89b-12d3-a456-426614174000",
          status: "queued",
        }),
        get: async () => ({
          id: "signal_123e4567-e89b-12d3-a456-426614174000",
          status: "queued",
        }),
      },
      system: {
        health: async () => ({ status: "ok", timestamp: "x", version: "x" }),
      },
    };

    expect(() =>
      registerContractTools(server, apiContract, client, {
        prefix: "lightfast",
      })
    ).not.toThrow();
  });

  it("does not throw on an empty contract", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    expect(() =>
      registerContractTools(server, {}, {}, { prefix: "lightfast" })
    ).not.toThrow();
  });
});
