import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("developer-connections tRPC router", () => {
  it("removes the empty developer-connections router after the TanStack migration", () => {
    const routerPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/developer-connections.ts"
    );
    const rootPath = resolve(apiRoot, "root.ts");

    expect(existsSync(routerPath)).toBe(false);
    expect(existsSync(rootPath)).toBe(false);
  });
});
