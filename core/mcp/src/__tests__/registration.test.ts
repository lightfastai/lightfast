import { apiContract } from "@repo/api-contract";
import { InMemoryTransport, McpClient as Client, McpServer } from "@vendor/mcp";
import { registerContractTools } from "@vendor/orpc-mcp-adapter";
import { describe, expect, it, vi } from "vitest";

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const queuedSignal = {
  id: signalId,
  status: "queued",
  visibilityScope: "user",
};
const systemHealth = {
  status: "ok",
  timestamp: "2026-05-21T00:00:00.000Z",
  version: "test",
};

function createLightfastClientStub() {
  return {
    signals: {
      create: vi.fn(async () => queuedSignal),
      get: vi.fn(async () => ({
        ...queuedSignal,
        classification: null,
        createdAt: "2026-05-21T00:00:00.000Z",
        input: "Run the verification plan",
        updatedAt: "2026-05-21T00:01:00.000Z",
      })),
    },
    system: {
      health: vi.fn(async () => systemHealth),
    },
  };
}

async function connectRegisteredServer(
  contract: Record<string, unknown> = apiContract,
  lightfastClient = createLightfastClientStub()
) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerContractTools(server, contract, lightfastClient, {
    prefix: "lightfast",
  });

  const mcpClient = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    mcpClient.connect(clientTransport),
  ]);

  return { lightfastClient, mcpClient, server };
}

async function closeRegisteredServer(
  context: Awaited<ReturnType<typeof connectRegisteredServer>>
) {
  await context.mcpClient.close();
  await context.server.close();
}

describe("MCP tool registration", () => {
  it("exposes every public contract procedure as an MCP tool", async () => {
    const context = await connectRegisteredServer();

    try {
      const { tools } = await context.mcpClient.listTools();

      expect(tools.map((tool) => tool.name)).toEqual([
        "lightfast_signals_create",
        "lightfast_signals_get",
        "lightfast_system_health",
      ]);
      expect(
        tools.find((tool) => tool.name === "lightfast_signals_create")
      ).toMatchObject({
        description:
          "Creates a creator-visible signal from raw text and queues asynchronous classification.",
        inputSchema: {
          properties: {
            input: expect.objectContaining({ type: "string" }),
          },
          required: ["input"],
          type: "object",
        },
        outputSchema: {
          properties: {
            id: expect.objectContaining({ type: "string" }),
            status: expect.objectContaining({ const: "queued" }),
            visibilityScope: expect.objectContaining({ const: "user" }),
          },
          required: ["id", "status", "visibilityScope"],
          type: "object",
        },
      });
    } finally {
      await closeRegisteredServer(context);
    }
  });

  it("calls the Lightfast SDK client and returns structured MCP content", async () => {
    const context = await connectRegisteredServer();

    try {
      const result = (await context.mcpClient.callTool({
        arguments: { input: "  Run the verification plan  " },
        name: "lightfast_signals_create",
      })) as {
        content?: unknown;
        structuredContent?: unknown;
      };

      expect(context.lightfastClient.signals.create).toHaveBeenCalledWith({
        input: "Run the verification plan",
      });
      expect(result.structuredContent).toEqual(queuedSignal);
      expect(result.content).toEqual([
        { type: "text", text: JSON.stringify(queuedSignal, null, 2) },
      ]);
    } finally {
      await closeRegisteredServer(context);
    }
  });

  it("calls zero-input contract procedures without synthetic arguments", async () => {
    const context = await connectRegisteredServer();

    try {
      const result = (await context.mcpClient.callTool({
        name: "lightfast_system_health",
      })) as {
        structuredContent?: unknown;
      };

      expect(context.lightfastClient.system.health).toHaveBeenCalledWith();
      expect(result.structuredContent).toEqual(systemHealth);
    } finally {
      await closeRegisteredServer(context);
    }
  });

  it("returns MCP error content when the SDK client rejects", async () => {
    const lightfastClient = createLightfastClientStub();
    lightfastClient.signals.get.mockRejectedValueOnce(new Error("api down"));
    const context = await connectRegisteredServer(apiContract, lightfastClient);

    try {
      const result = (await context.mcpClient.callTool({
        arguments: { id: signalId },
        name: "lightfast_signals_get",
      })) as {
        content?: unknown;
        isError?: boolean;
      };

      expect(result.isError).toBe(true);
      expect(result.content).toEqual([{ type: "text", text: "api down" }]);
    } finally {
      await closeRegisteredServer(context);
    }
  });

  it("does not throw on an empty contract", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    expect(() =>
      registerContractTools(server, {}, {}, { prefix: "lightfast" })
    ).not.toThrow();
  });
});
