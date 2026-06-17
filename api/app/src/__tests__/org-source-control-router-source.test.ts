import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("org source-control tRPC router", () => {
  it("does not expose migrated source-control procedures after the TanStack migration", () => {
    const source = readFileSync(
      resolve(apiRoot, "router/(pending-not-allowed)/org-source-control.ts"),
      "utf8"
    );

    expect(source).not.toContain("orgProcedure");
    expect(source).not.toContain("orgAdminProcedure");
    expect(source).not.toContain("getActiveOrgBinding");
    expect(source).not.toContain("listRepositories");
    expect(source).not.toContain("importRepository");
  });
});
