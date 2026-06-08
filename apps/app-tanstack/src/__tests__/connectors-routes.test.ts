import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app-tanstack connector API routes", () => {
  it("mounts connector OAuth callbacks as TanStack server routes", () => {
    const linearCallbackSource = source(
      "src/routes/api/connectors/linear/oauth/callback.ts"
    );
    const xCallbackSource = source(
      "src/routes/api/connectors/x/oauth/callback.ts"
    );

    expect(linearCallbackSource).toContain(
      'createFileRoute("/api/connectors/linear/oauth/callback")'
    );
    expect(linearCallbackSource).toContain("completeLinearConnectorOAuth");
    expect(linearCallbackSource).toContain(
      "Response.redirect(result.redirectUrl)"
    );
    expect(xCallbackSource).toContain(
      'createFileRoute("/api/connectors/x/oauth/callback")'
    );
    expect(xCallbackSource).toContain("completeXConnectorOAuth");
    expect(xCallbackSource).toContain("Response.redirect(result.redirectUrl)");

    for (const routeSource of [linearCallbackSource, xCallbackSource]) {
      expect(routeSource).not.toContain("next/");
    }
  });

  it("mounts the X MCP bridge on the app-tanstack API surface", () => {
    const xMcpSource = source("src/routes/api/connectors/x/mcp.ts");

    expect(xMcpSource).toContain('createFileRoute("/api/connectors/x/mcp")');
    expect(xMcpSource).toContain("handleXConnectorMcpRequest");
    expect(xMcpSource).toContain("GET:");
    expect(xMcpSource).toContain("POST:");
    expect(xMcpSource).toContain("DELETE:");
    expect(xMcpSource).not.toContain("next/");
  });
});
