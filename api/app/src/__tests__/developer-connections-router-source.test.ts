import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("developer-connections tRPC router", () => {
  it("removes the empty developer-connections router after the TanStack migration", () => {
    const routerPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/developer-connections.ts"
    );
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(existsSync(routerPath)).toBe(false);
    expect(rootSource).not.toContain("developerConnectionsRouter");
    expect(rootSource).not.toContain("developerConnections:");
    expect(rootSource).not.toContain(
      "router/(pending-not-allowed)/developer-connections"
    );
  });
});
