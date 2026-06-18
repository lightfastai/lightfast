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
  });

  it("ports native OAuth facade endpoints through explicit api/app handlers", () => {
    const configSource = source("src/routes/api/oauth/$client/config.ts");
    const finalizeSource = source("src/routes/api/oauth/finalize.ts");
    const sessionSource = source("src/routes/api/oauth/desktop/session.ts");
    const nativeServerSource = source("src/server/oauth/native-auth.ts");

    expect(configSource).toContain(
      'createFileRoute("/api/oauth/$client/config")'
    );
    expect(configSource).toContain("nativeClientSchema");
    expect(configSource).toContain("nativeOAuthConfigSchema");
    expect(configSource).toContain("getNativeOAuthClientConfig");
    expect(configSource).toContain("params.client");
    expect(configSource).not.toContain("caller.native.auth");
    expect(finalizeSource).toContain('createFileRoute("/api/oauth/finalize")');
    expect(finalizeSource).toContain("nativeFinalizeRequestSchema");
    expect(finalizeSource).toContain("nativeSessionMetadataSchema");
    expect(finalizeSource).toContain("finalizeNativeAuthAttemptForRequest");
    expect(finalizeSource).not.toContain("caller.native.auth");
    expect(sessionSource).toContain(
      'createFileRoute("/api/oauth/desktop/session")'
    );
    expect(sessionSource).toContain("nativeSessionMetadataSchema");
    expect(sessionSource).toContain("getNativeAuthSessionForRequest");
    expect(sessionSource).toContain('source: "desktop"');
    expect(sessionSource).not.toContain("caller.native.auth");
    expect(nativeServerSource).toContain("@api/app/native-auth");
    expect(nativeServerSource).not.toContain("appRouter");
    expect(nativeServerSource).not.toContain("createTRPCContext");
    expect(nativeServerSource).not.toContain("TRPCError");
    expect(nativeServerSource).not.toContain("getHTTPStatusCodeFromError");
    expect(nativeServerSource).toContain("Unexpected auth error");

    for (const routeSource of [
      configSource,
      finalizeSource,
      sessionSource,
      nativeServerSource,
    ]) {
      expect(routeSource).not.toContain("next/");
      expect(routeSource).not.toContain("server-only");
      expect(routeSource).not.toContain('"use server"');
    }
  });
});
