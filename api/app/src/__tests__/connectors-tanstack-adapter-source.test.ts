import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("connectors TanStack adapter boundary", () => {
  it("exports connector server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/connectors");
  });

  it("defines connector server functions in the adapter layer", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/connectors.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("listConnectorsCommand");
    expect(source).toContain("listConnectorSectionsCommand");
    expect(source).toContain("startConnectorOAuthCommand");
    expect(source).toContain("refreshConnectorToolsCommand");
    expect(source).toContain("setConnectorAutomationEnabledCommand");
    expect(source).toContain("setConnectorAgentEnabledCommand");
    expect(source).toContain("disconnectConnectorCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
  });
});
