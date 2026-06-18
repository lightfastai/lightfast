import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("public API oRPC server cleanup", () => {
  it("removes the legacy api/app oRPC server router", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    };

    expect(existsSync(resolve(repoRoot, "src/orpc"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "src/index.ts"))).toBe(false);
    expect(packageJson.dependencies?.["@orpc/server"]).toBeUndefined();
    expect(Object.hasOwn(packageJson.exports ?? {}, ".")).toBe(false);
  });
});
