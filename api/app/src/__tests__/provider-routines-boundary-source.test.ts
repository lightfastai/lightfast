import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("provider routine service boundary", () => {
  it("keeps adapter imports pinned to concrete provider routine modules", () => {
    const mcpProxySource = source("adapters/internal/mcp-proxy.ts");
    const cliApiSource = source("adapters/cli-api.ts");

    expect(mcpProxySource).toContain("../../services/provider-routines/call");
    expect(mcpProxySource).toContain("../../services/provider-routines/find");
    expect(mcpProxySource).not.toMatch(
      /\bfrom\s*["']\.\.\/\.\.\/services\/provider-routines["']/
    );

    expect(cliApiSource).toContain("../services/provider-routines/context");
    expect(cliApiSource).toContain("../services/provider-routines/call");
    expect(cliApiSource).toContain("../services/provider-routines/find");
    expect(cliApiSource).not.toMatch(
      /\bfrom\s*["']\.\.\/services\/provider-routines["']/
    );
  });

  it("does not keep a broad provider routine service barrel", () => {
    expect(
      existsSync(resolve(apiRoot, "services/provider-routines/index.ts"))
    ).toBe(false);
  });
});
