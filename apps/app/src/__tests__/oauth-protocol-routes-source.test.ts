import { existsSync, readFileSync } from "node:fs";
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

const rootApiAppImportPattern = /from\s+["@']@api\/app["@']/;

const mcpOAuthProtocolRouteExpectations = [
  {
    staticImport:
      'import { handleMcpOAuthAuthorizationServerMetadataRequest } from "@api/app/mcp-oauth/server-routes"',
    getSource: () =>
      source("src/routes/[.]well-known/oauth-authorization-server.ts"),
  },
  {
    staticImport:
      'import { handleMcpOAuthJwksRequest } from "@api/app/mcp-oauth/server-routes"',
    getSource: () => source("src/routes/oauth/jwks.ts"),
  },
  {
    staticImport:
      'import { handleRegisterMcpOAuthClientRequest } from "@api/app/mcp-oauth/server-routes"',
    getSource: () => source("src/routes/oauth/register.ts"),
  },
  {
    staticImport:
      'import { handleGetRegisteredMcpOAuthClientRequest } from "@api/app/mcp-oauth/server-routes"',
    getSource: () => source("src/routes/oauth/register/$clientId.ts"),
  },
  {
    staticImport:
      'import { handleMcpOAuthTokenRequest } from "@api/app/mcp-oauth/server-routes"',
    getSource: () => source("src/routes/oauth/token.ts"),
  },
  {
    staticImport:
      'import { handleMcpOAuthRevokeRequest } from "@api/app/mcp-oauth/server-routes"',
    getSource: () => source("src/routes/oauth/revoke.ts"),
  },
] as const;

describe("app OAuth protocol route migration", () => {
  it("ports MCP OAuth protocol endpoints as TanStack server routes", () => {
    const metadataSource = source(
      "src/routes/[.]well-known/oauth-authorization-server.ts"
    );
    const jwksSource = source("src/routes/oauth/jwks.ts");
    const registerSource = source("src/routes/oauth/register.ts");
    const registeredClientSource = source(
      "src/routes/oauth/register/$clientId.ts"
    );
    const tokenSource = source("src/routes/oauth/token.ts");
    const revokeSource = source("src/routes/oauth/revoke.ts");
    const serverRoutesSource = repoSource(
      "api/app/src/mcp-oauth/server-routes.ts"
    );
    const consentSource = repoSource(
      "api/app/src/adapters/tanstack/mcp-consent.ts"
    );
    const responsePath = resolve(appRoot, "src/server/oauth/mcp-response.ts");

    expect(metadataSource).toContain(
      'createFileRoute("/.well-known/oauth-authorization-server")'
    );
    expect(metadataSource).toContain('@api/app/mcp-oauth/server-routes"');
    expect(metadataSource).toContain(
      "handleMcpOAuthAuthorizationServerMetadataRequest"
    );
    expect(jwksSource).toContain('createFileRoute("/oauth/jwks")');
    expect(jwksSource).toContain('@api/app/mcp-oauth/server-routes"');
    expect(jwksSource).toContain("handleMcpOAuthJwksRequest");
    expect(registerSource).toContain('createFileRoute("/oauth/register")');
    expect(registerSource).toContain('@api/app/mcp-oauth/server-routes"');
    expect(registerSource).toContain("handleRegisterMcpOAuthClientRequest");
    expect(registerSource).toContain("POST:");
    expect(registeredClientSource).toContain(
      'createFileRoute("/oauth/register/$clientId")'
    );
    expect(registeredClientSource).toContain(
      '@api/app/mcp-oauth/server-routes"'
    );
    expect(registeredClientSource).toContain(
      "handleGetRegisteredMcpOAuthClientRequest"
    );
    expect(registeredClientSource).toContain("params.clientId");
    expect(tokenSource).toContain('createFileRoute("/oauth/token")');
    expect(tokenSource).toContain('@api/app/mcp-oauth/server-routes"');
    expect(tokenSource).toContain("handleMcpOAuthTokenRequest");
    expect(revokeSource).toContain('createFileRoute("/oauth/revoke")');
    expect(revokeSource).toContain('@api/app/mcp-oauth/server-routes"');
    expect(revokeSource).toContain("handleMcpOAuthRevokeRequest");
    expect(serverRoutesSource).toContain("MCP_SUPPORTED_SCOPES");
    expect(serverRoutesSource).toContain("authorization_endpoint");
    expect(serverRoutesSource).toContain(
      "token_endpoint_auth_methods_supported"
    );
    expect(serverRoutesSource).toContain("getMcpOAuthJwks");
    expect(serverRoutesSource).toContain("registerMcpOAuthClient");
    expect(serverRoutesSource).toContain("getRegisteredMcpOAuthClient");
    expect(serverRoutesSource).toContain("exchangeMcpAuthorizationCode");
    expect(serverRoutesSource).toContain("rotateMcpRefreshTokenSecret");
    expect(serverRoutesSource).toContain("revokeMcpRefreshTokenSecret");
    expect(serverRoutesSource).toContain("readOAuthBody");
    expect(serverRoutesSource).toContain("bearerToken");
    expect(serverRoutesSource).toContain("process.env.VITE_LIGHTFAST_APP_URL");
    expect(serverRoutesSource).toContain("process.env.SERVICE_JWT_SECRET");
    expect(consentSource).toContain("issueMcpAuthorizationCode");
    expect(existsSync(responsePath)).toBe(false);

    for (const routeSource of [
      metadataSource,
      jwksSource,
      registerSource,
      registeredClientSource,
      tokenSource,
      revokeSource,
      serverRoutesSource,
      consentSource,
    ]) {
      expect(routeSource).not.toMatch(rootApiAppImportPattern);
    }

    for (const routeSource of [
      metadataSource,
      jwksSource,
      registerSource,
      registeredClientSource,
      tokenSource,
      revokeSource,
    ]) {
      expect(routeSource).not.toContain("next/");
      expect(routeSource).not.toContain("server-only");
      expect(routeSource).not.toContain('"use server"');
    }

    for (const appRouteSource of [
      metadataSource,
      jwksSource,
      registerSource,
      registeredClientSource,
      tokenSource,
      revokeSource,
    ]) {
      expect(appRouteSource).not.toContain("@db/app");
      expect(appRouteSource).not.toContain("~/server/oauth/mcp-response");
    }

    for (const expectation of mcpOAuthProtocolRouteExpectations) {
      const routeSource = expectation.getSource();

      expect(routeSource).toContain("await import(");
      expect(routeSource).toContain('@api/app/mcp-oauth/server-routes"');
      expect(routeSource).not.toContain(expectation.staticImport);
    }
  });

  it("ports native OAuth facade endpoints through explicit api/app handlers", () => {
    const configSource = source("src/routes/api/oauth/$client/config.ts");
    const finalizeSource = source("src/routes/api/oauth/finalize.ts");
    const sessionSource = source("src/routes/api/oauth/desktop/session.ts");
    const nativeServerPath = resolve(
      appRoot,
      "src/server/oauth/native-auth.ts"
    );
    const nativeServerRoutesSource = repoSource(
      "api/app/src/native-auth/server-routes.ts"
    );
    const apiPackageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports: Record<string, { default: string; types: string }>;
    };

    expect(configSource).toContain(
      'createFileRoute("/api/oauth/$client/config")'
    );
    expect(configSource).toContain('@api/app/native-auth/server-routes"');
    expect(configSource).toContain("handleNativeOAuthClientConfigRequest");
    expect(configSource).toContain("params.client");
    expect(configSource).not.toContain("~/server/oauth/native-auth");
    expect(configSource).not.toContain("caller.native.auth");
    expect(finalizeSource).toContain('createFileRoute("/api/oauth/finalize")');
    expect(finalizeSource).toContain('@api/app/native-auth/server-routes"');
    expect(finalizeSource).toContain("handleNativeOAuthFinalizeRequest");
    expect(finalizeSource).not.toContain("~/server/oauth/native-auth");
    expect(finalizeSource).not.toContain("caller.native.auth");
    expect(sessionSource).toContain(
      'createFileRoute("/api/oauth/desktop/session")'
    );
    expect(sessionSource).toContain('@api/app/native-auth/server-routes"');
    expect(sessionSource).toContain("handleNativeOAuthDesktopSessionRequest");
    expect(sessionSource).not.toContain("~/server/oauth/native-auth");
    expect(sessionSource).not.toContain("caller.native.auth");
    expect(apiPackageJson.exports["./native-auth/server-routes"]).toEqual({
      default: "./src/native-auth/server-routes.ts",
      types: "./src/native-auth/server-routes.ts",
    });
    expect(nativeServerRoutesSource).toContain("nativeClientSchema");
    expect(nativeServerRoutesSource).toContain("nativeOAuthConfigSchema");
    expect(nativeServerRoutesSource).toContain("getNativeOAuthClientConfig");
    expect(nativeServerRoutesSource).toContain("nativeFinalizeRequestSchema");
    expect(nativeServerRoutesSource).toContain("nativeSessionMetadataSchema");
    expect(nativeServerRoutesSource).toContain(
      "finalizeNativeAuthAttemptForRequest"
    );
    expect(nativeServerRoutesSource).toContain(
      "getNativeAuthSessionForRequest"
    );
    expect(nativeServerRoutesSource).toContain('source: "desktop"');
    expect(nativeServerRoutesSource).not.toContain("appRouter");
    expect(nativeServerRoutesSource).not.toContain("createTRPCContext");
    expect(nativeServerRoutesSource).not.toContain("TRPCError");
    expect(nativeServerRoutesSource).not.toContain(
      "getHTTPStatusCodeFromError"
    );
    expect(nativeServerRoutesSource).toContain("Unexpected auth error");
    expect(existsSync(nativeServerPath)).toBe(false);

    for (const routeSource of [
      configSource,
      finalizeSource,
      sessionSource,
      nativeServerRoutesSource,
    ]) {
      expect(routeSource).not.toContain("next/");
      expect(routeSource).not.toContain("server-only");
      expect(routeSource).not.toContain('"use server"');
    }
  });
});
