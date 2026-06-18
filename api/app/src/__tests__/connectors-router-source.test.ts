import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("connectors tRPC router", () => {
  it("removes the empty connector router after the TanStack migration", () => {
    const routerPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/connectors.ts"
    );
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(existsSync(routerPath)).toBe(false);
    expect(rootSource).not.toContain("connectorsRouter");
    expect(rootSource).not.toContain("connectors:");
    expect(rootSource).not.toContain("router/(pending-not-allowed)/connectors");
  });
});
