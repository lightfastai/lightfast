import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("app connector API routes", () => {
  it("mounts connector OAuth callbacks as TanStack server routes", () => {
    const linearCallbackSource = source(
      "src/routes/api/connectors/linear/oauth/callback.ts"
    );
    const xCallbackSource = source(
      "src/routes/api/connectors/x/oauth/callback.ts"
    );
    const granolaCallbackSource = source(
      "src/routes/api/connectors/granola/oauth/callback.ts"
    );
    const connectorOAuthAdapterSource = repoSource(
      "api/app/src/adapters/internal/connector-oauth.ts"
    );
    const apiPackageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports: Record<string, { default: string; types: string }>;
    };

    expect(linearCallbackSource).toContain(
      'createFileRoute("/api/connectors/linear/oauth/callback")'
    );
    expect(linearCallbackSource).toContain(
      '@api/app/internal-api/connector-oauth"'
    );
    expect(linearCallbackSource).toContain(
      "handleLinearConnectorOAuthCallbackRequest"
    );
    expect(linearCallbackSource).not.toContain("completeLinearConnectorOAuth");
    expect(linearCallbackSource).not.toContain("Response.redirect");
    expect(xCallbackSource).toContain(
      'createFileRoute("/api/connectors/x/oauth/callback")'
    );
    expect(xCallbackSource).toContain('@api/app/internal-api/connector-oauth"');
    expect(xCallbackSource).toContain("handleXConnectorOAuthCallbackRequest");
    expect(xCallbackSource).not.toContain("completeXConnectorOAuth");
    expect(xCallbackSource).not.toContain("Response.redirect");
    expect(granolaCallbackSource).toContain(
      'createFileRoute("/api/connectors/granola/oauth/callback")'
    );
    expect(granolaCallbackSource).toContain(
      '@api/app/internal-api/connector-oauth"'
    );
    expect(granolaCallbackSource).toContain(
      "handleGranolaUserConnectorOAuthCallbackRequest"
    );
    expect(granolaCallbackSource).not.toContain(
      "completeGranolaUserConnectorOAuth"
    );
    expect(granolaCallbackSource).not.toContain("missing_oauth_code");
    expect(granolaCallbackSource).not.toContain("Response.redirect");
    expect(apiPackageJson.exports["./internal-api/connector-oauth"]).toEqual({
      default: "./src/adapters/internal/connector-oauth.ts",
      types: "./src/adapters/internal/connector-oauth.ts",
    });
    expect(connectorOAuthAdapterSource).toContain(
      "completeLinearConnectorOAuth"
    );
    expect(connectorOAuthAdapterSource).toContain("completeXConnectorOAuth");
    expect(connectorOAuthAdapterSource).toContain(
      "completeGranolaUserConnectorOAuth"
    );
    expect(connectorOAuthAdapterSource).toContain("@vendor/clerk/server");
    expect(connectorOAuthAdapterSource).toContain(
      "auth({ treatPendingAsSignedOut: false })"
    );
    expect(connectorOAuthAdapterSource).toContain("callbackUserId");
    expect(connectorOAuthAdapterSource).toContain("missing_oauth_code");
    expect(connectorOAuthAdapterSource).toContain("Response.redirect");

    for (const routeSource of [
      linearCallbackSource,
      xCallbackSource,
      granolaCallbackSource,
      connectorOAuthAdapterSource,
    ]) {
      expect(routeSource).not.toContain("next/");
    }
  });

  it("mounts the X MCP bridge on the app API surface", () => {
    const xMcpSource = source("src/routes/api/connectors/x/mcp.ts");
    const connectorMcpAdapterSource = repoSource(
      "api/app/src/adapters/internal/connector-mcp.ts"
    );
    const apiPackageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports: Record<string, { default: string; types: string }>;
    };

    expect(xMcpSource).toContain('createFileRoute("/api/connectors/x/mcp")');
    expect(xMcpSource).toContain('@api/app/internal-api/connector-mcp"');
    expect(xMcpSource).toContain("handleXConnectorMcpRequest");
    expect(xMcpSource).toContain("GET:");
    expect(xMcpSource).toContain("POST:");
    expect(xMcpSource).toContain("DELETE:");
    expect(xMcpSource).not.toContain("@api/app/services/connectors");
    expect(apiPackageJson.exports["./internal-api/connector-mcp"]).toEqual({
      default: "./src/adapters/internal/connector-mcp.ts",
      types: "./src/adapters/internal/connector-mcp.ts",
    });
    expect(connectorMcpAdapterSource).toContain(
      "../../services/connectors/x-mcp-bridge"
    );
    expect(connectorMcpAdapterSource).toContain("handleXConnectorMcpRequest");
    expect(connectorMcpAdapterSource).not.toContain(
      '../../services/connectors"'
    );

    for (const routeSource of [xMcpSource, connectorMcpAdapterSource]) {
      expect(routeSource).not.toContain("next/");
    }
  });
});
