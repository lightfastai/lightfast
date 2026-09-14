import { Client, InMemoryTransport, McpServer } from "@vendor/mcp";
import type { LightfastClient } from "lightfast";
import { describe, expect, it, vi } from "vitest";
import { createLightfastMcpServer } from "../server";
import { registerLightfastMcpTools } from "../tools/register";

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
        entityLinks: [],
        createdAt: "2026-05-21T00:00:00.000Z",
        input: "Run the verification plan",
        updatedAt: "2026-05-21T00:01:00.000Z",
      })),
      list: vi.fn(),
    },
    system: {
      health: vi.fn(async () => systemHealth),
    },
  };
}

async function connectRegisteredServer(
  lightfastClient = createLightfastClientStub()
) {
  const server = createLightfastMcpServer(lightfastClient as LightfastClient);

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
  it("exposes every policy-enabled public contract procedure as an MCP tool", async () => {
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
          "Create a new Lightfast signal from user-provided text in the selected organization. Use this when the user wants Lightfast to remember, classify, or route a new signal.",
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
    const context = await connectRegisteredServer(lightfastClient);

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
      registerLightfastMcpTools(server, {
        contract: {},
        execute: async () => ({}),
        policy: {},
      })
    ).not.toThrow();
  });

  it("returns the production missing-procedure error", async () => {
    const lightfastClient = createLightfastClientStub();
    Reflect.deleteProperty(lightfastClient.signals, "get");
    const context = await connectRegisteredServer(lightfastClient);

    try {
      expect(
        await context.mcpClient.callTool({
          name: "lightfast_signals_get",
          arguments: { id: signalId },
        })
      ).toEqual({
        content: [
          {
            type: "text",
            text: "Missing Lightfast SDK procedure for signals.get",
          },
        ],
        isError: true,
      });
    } finally {
      await closeRegisteredServer(context);
    }
  });
});
