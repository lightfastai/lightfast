import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("MCP OAuth package entrypoint", () => {
  it("keeps MCP OAuth behind its explicit api/app entrypoint", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      exports?: Record<string, unknown>;
    };

    expect(packageJson.exports).toHaveProperty("./mcp-oauth");
    expect(Object.hasOwn(packageJson.exports ?? {}, ".")).toBe(false);
    expect(existsSync(resolve(apiRoot, "src/index.ts"))).toBe(false);
  });
});
