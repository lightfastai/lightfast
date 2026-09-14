import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { Client, StdioClientTransport } from "@vendor/mcp";
import { describe, expect, it } from "vitest";

const bundle = resolve(import.meta.dirname, "../../dist/index.mjs");
const fetchFixture = resolve(import.meta.dirname, "fixtures/stdio-fetch.mjs");

describe("bundled stdio MCP interface", () => {
  it("preserves initialization, enumeration, dispatch and errors with local fixtures", async () => {
    const client = new Client({ name: "fixture-client", version: "0.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", fetchFixture, bundle],
      env: {
        LIGHTFAST_API_KEY: "lf_fixture",
        LIGHTFAST_API_URL: "https://mcp-fixture.invalid/api/v1/",
      },
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    try {
      await client.connect(transport);
      const result = {
        server: client.getServerVersion(),
        capabilities: client.getServerCapabilities(),
        tools: await client.listTools(),
        create: await client.callTool({
          name: "lightfast_signals_create",
          arguments: { input: "  Run the verification plan  " },
        }),
        health: await client.callTool({ name: "lightfast_system_health" }),
        error: await client.callTool({
          name: "lightfast_signals_get",
          arguments: { id: "signal_123e4567-e89b-12d3-a456-426614174000" },
        }),
        hidden: await client.callTool({ name: "lightfast_signals_list" }),
        invalid: await client.callTool({
          name: "lightfast_signals_create",
          arguments: { input: "" },
        }),
      };
      expect(result).toMatchSnapshot();
      expect(stderr).toBe("");
    } finally {
      await client.close();
    }
  });

  it.each([
    [{}, "LIGHTFAST_API_KEY environment variable is required"],
    [
      { LIGHTFAST_API_KEY: "lf_fixture" },
      "LIGHTFAST_API_URL environment variable is required",
    ],
  ])("requires explicit startup configuration: %j", (env, message) => {
    const result = spawnSync(
      process.execPath,
      ["--import", fetchFixture, bundle],
      {
        env,
        encoding: "utf8",
        timeout: 5000,
      }
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(`${message}\n`);
  });
});
