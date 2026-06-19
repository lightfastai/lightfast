import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("connector service domain errors", () => {
  it("keeps connector dispatch and config errors framework-neutral", () => {
    for (const file of [
      "services/connectors/index.ts",
      "services/connectors/config.ts",
    ]) {
      const fileSource = source(file);

      expect(fileSource, file).toContain("../../domain/errors");
      expect(fileSource, file).not.toContain("@trpc/server");
      expect(fileSource, file).not.toContain("TRPCError");
    }

    const userConnectorIndexSource = source(
      "services/user-connectors/index.ts"
    );
    expect(userConnectorIndexSource).not.toContain("../../domain/errors");
    expect(userConnectorIndexSource).not.toContain("switch");
    expect(userConnectorIndexSource).not.toContain("unsupportedProvider");
  });

  it("keeps connector provider flow errors framework-neutral", () => {
    for (const file of [
      "services/connectors/linear-flow.ts",
      "services/connectors/x-flow.ts",
      "services/user-connectors/granola-flow.ts",
    ]) {
      const fileSource = source(file);

      expect(fileSource, file).toContain("../../domain/errors");
      expect(fileSource, file).not.toContain("@trpc/server");
      expect(fileSource, file).not.toContain("TRPCError");
    }
  });

  it("keeps X connector MCP HTTP parsing in the internal adapter", () => {
    const serviceSource = source("services/connectors/x-mcp-bridge.ts");
    const adapterSource = source("adapters/internal/connector-mcp.ts");

    expect(serviceSource).not.toContain("parseRequestBody");
    expect(serviceSource).not.toContain("bearerToken");
    expect(serviceSource).not.toContain('headers.get("authorization")');
    expect(serviceSource).not.toContain("MALFORMED_JSON_REQUEST");
    expect(serviceSource).not.toContain("Invalid request body");

    expect(adapterSource).toContain("parseRequestBody");
    expect(adapterSource).toContain("bearerToken");
    expect(adapterSource).toContain('headers.get("authorization")');
    expect(adapterSource).toContain("MALFORMED_JSON_REQUEST");
    expect(adapterSource).toContain("Invalid request body");
    expect(adapterSource).toContain("parsedBody");
    expect(adapterSource).toContain("appOrigin");
    expect(adapterSource).toContain("token");
    expect(adapterSource).toContain("../../services/connectors/x-mcp-bridge");
    expect(adapterSource).not.toMatch(
      /\bfrom\s*["']\.\.\/\.\.\/services\/connectors["']/
    );
  });
});
