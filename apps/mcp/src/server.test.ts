import { Client, InMemoryTransport } from "@vendor/mcp";
import { describe, expect, it } from "vitest";

import { createLocalMcpServer } from "./server";

describe("local MCP server", () => {
  it("completes initialize and exposes an intentionally empty tool list", async () => {
    const server = createLocalMcpServer();
    const client = new Client({ name: "acceptance", version: "0.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      await expect(client.listTools()).resolves.toEqual({ tools: [] });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
