import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { Client, StdioClientTransport } from "@vendor/mcp";
import { describe, expect, it } from "vitest";

function listeningTcpSockets(pid: number): string {
  try {
    return execFileSync(
      "lsof",
      ["-nP", "-a", "-p", String(pid), "-iTCP", "-sTCP:LISTEN"],
      { encoding: "utf8" }
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 1
    ) {
      return "";
    }
    throw error;
  }
}

describe("local MCP stdio process", () => {
  it("completes a real initialize handshake without a hosted listener", async () => {
    const transport = new StdioClientTransport({
      args: ["--import", "tsx", resolve(import.meta.dirname, "index.ts")],
      command: process.execPath,
      stderr: "pipe",
    });
    const client = new Client({ name: "stdio-acceptance", version: "0.0.0" });

    await client.connect(transport);

    try {
      await expect(client.listTools()).resolves.toEqual({ tools: [] });
      expect(transport.pid).not.toBeNull();
      expect(listeningTcpSockets(transport.pid as number)).toBe("");
    } finally {
      await client.close();
    }
  });
});
