import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("developer-connections tRPC router", () => {
  it("does not expose migrated developer-connection procedures after the TanStack migration", () => {
    const source = readFileSync(
      resolve(apiRoot, "router/(pending-not-allowed)/developer-connections.ts"),
      "utf8"
    );

    expect(source).not.toContain("boundOrgProcedure");
    expect(source).not.toContain("boundOrgAdminProcedure");
    expect(source).not.toContain("listDeveloperConnectionsForOrg");
    expect(source).not.toContain("connectDeveloperConnection");
    expect(source).not.toContain("startSentryDeveloperConnectionAuth");
    expect(source).not.toContain("completeSentryDeveloperConnectionAuth");
    expect(source).not.toContain("setDeveloperConnectionSandboxEnabled");
    expect(source).not.toContain("disconnectDeveloperConnection");
  });
});
