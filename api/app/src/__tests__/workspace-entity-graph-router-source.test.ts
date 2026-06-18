import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("workspace entity graph tRPC router", () => {
  it("removes the migrated entity graph router after the TanStack migration", () => {
    const routerPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/workspace-entity-graph.ts"
    );
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(existsSync(routerPath)).toBe(false);
    expect(rootSource).not.toContain("workspaceEntityGraphRouter");
    expect(rootSource).not.toContain("entityGraph:");
    expect(rootSource).not.toContain(
      "router/(pending-not-allowed)/workspace-entity-graph"
    );
  });
});
