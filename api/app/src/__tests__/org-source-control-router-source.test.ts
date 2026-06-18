import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("org source-control tRPC router", () => {
  it("removes the empty source-control router after the TanStack migration", () => {
    const routerPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/org-source-control.ts"
    );
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(existsSync(routerPath)).toBe(false);
    expect(rootSource).not.toContain("orgSourceControlRouter");
    expect(rootSource).not.toContain("sourceControl:");
    expect(rootSource).not.toContain(
      "router/(pending-not-allowed)/org-source-control"
    );
  });
});
