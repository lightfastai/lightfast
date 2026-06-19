import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("automations tRPC router", () => {
  it("removes migrated automation procedures from tRPC", () => {
    expect(
      existsSync(
        resolve(apiRoot, "router/(pending-not-allowed)/automations.ts")
      )
    ).toBe(false);
    expect(existsSync(resolve(apiRoot, "root.ts"))).toBe(false);
  });
});
