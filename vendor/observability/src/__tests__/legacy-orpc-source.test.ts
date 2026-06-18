import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "../..");

describe("legacy oRPC observability boundary", () => {
  it("does not keep a dead oRPC observability entrypoint or dependencies", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(packageRoot, "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    };

    expect(packageJson.exports).not.toHaveProperty("./orpc");
    expect(packageJson.dependencies?.["@orpc/client"]).toBeUndefined();
    expect(packageJson.dependencies?.["@orpc/server"]).toBeUndefined();
    expect(existsSync(resolve(packageRoot, "src/orpc.ts"))).toBe(false);
  });
});
