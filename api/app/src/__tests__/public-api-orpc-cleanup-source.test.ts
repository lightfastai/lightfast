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
    };
    const indexSource = source("src/index.ts");

    expect(existsSync(resolve(repoRoot, "src/orpc"))).toBe(false);
    expect(packageJson.dependencies?.["@orpc/server"]).toBeUndefined();
    expect(indexSource).not.toContain("orpcRouter");
    expect(indexSource).not.toContain("./orpc");
  });
});
