import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("automations tRPC router", () => {
  it("removes migrated automation procedures from tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "root.ts"), "utf8");

    expect(
      existsSync(
        resolve(apiRoot, "router/(pending-not-allowed)/automations.ts")
      )
    ).toBe(false);
    expect(rootSource).not.toContain("automationsRouter");
    expect(rootSource).not.toContain("automations:");
  });
});
