import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("connectors tRPC router", () => {
  it("does not expose migrated connector procedures after the TanStack migration", () => {
    const source = readFileSync(
      resolve(apiRoot, "router/(pending-not-allowed)/connectors.ts"),
      "utf8"
    );

    expect(source).not.toContain("setupProcedure");
    expect(source).not.toContain("orgAdminProcedure");
    expect(source).not.toContain("boundOrgAdminProcedure");
    expect(source).not.toContain("listConnectorsForOrg");
    expect(source).not.toContain("listUserConnectorsForViewer");
    expect(source).not.toContain("startConnectorOAuth");
    expect(source).not.toContain("refreshConnectorTools");
    expect(source).not.toContain("setConnectorAutomationEnabled");
    expect(source).not.toContain("setConnectorAgentEnabled");
    expect(source).not.toContain("disconnectConnector");
  });
});
