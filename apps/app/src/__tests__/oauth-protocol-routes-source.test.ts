import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

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
    const responseSource = source("src/server/oauth/mcp-response.ts");

    expect(metadataSource).toContain(
      'createFileRoute("/.well-known/oauth-authorization-server")'
    );
    expect(metadataSource).toContain("MCP_SUPPORTED_SCOPES");
    expect(metadataSource).toContain("authorization_endpoint");
    expect(metadataSource).toContain("token_endpoint_auth_methods_supported");
    expect(jwksSource).toContain('createFileRoute("/oauth/jwks")');
    expect(jwksSource).toContain("getMcpOAuthJwks");
    expect(registerSource).toContain('createFileRoute("/oauth/register")');
    expect(registerSource).toContain("registerMcpOAuthClient");
    expect(registerSource).toContain("readOAuthBody");
    expect(registerSource).toContain("POST:");
    expect(registeredClientSource).toContain(
      'createFileRoute("/oauth/register/$clientId")'
    );
    expect(registeredClientSource).toContain("getRegisteredMcpOAuthClient");
    expect(registeredClientSource).toContain("bearerToken");
    expect(registeredClientSource).toContain("params.clientId");
    expect(tokenSource).toContain('createFileRoute("/oauth/token")');
    expect(tokenSource).toContain("exchangeMcpAuthorizationCode");
    expect(tokenSource).toContain("rotateMcpRefreshTokenSecret");
    expect(tokenSource).toContain("requireOAuthServiceJwtSecret");
    expect(revokeSource).toContain('createFileRoute("/oauth/revoke")');
    expect(revokeSource).toContain("revokeMcpRefreshTokenSecret");
    expect(responseSource).toContain("env.VITE_LIGHTFAST_APP_URL");
    expect(responseSource).toContain("McpOAuthError");
    expect(responseSource).toContain("cache-control");
    expect(responseSource).toContain("readOAuthBody");
    expect(responseSource).toContain("bearerToken");

    for (const routeSource of [
      metadataSource,
      jwksSource,
      registerSource,
      registeredClientSource,
      tokenSource,
      revokeSource,
      responseSource,
    ]) {
      expect(routeSource).not.toContain("next/");
      expect(routeSource).not.toContain("server-only");
      expect(routeSource).not.toContain('"use server"');
    }
  });

  it("ports native OAuth facade endpoints through request-aware tRPC callers", () => {
    const configSource = source("src/routes/api/oauth/$client/config.ts");
    const finalizeSource = source("src/routes/api/oauth/finalize.ts");
    const nativeServerSource = source("src/server/oauth/native-auth.ts");

    expect(configSource).toContain(
      'createFileRoute("/api/oauth/$client/config")'
    );
    expect(configSource).toContain("nativeClientSchema");
    expect(configSource).toContain("nativeOAuthConfigSchema");
    expect(configSource).toContain("createNativeOAuthFacadeCaller");
    expect(configSource).toContain("params.client");
    expect(configSource).toContain("oauthConfig");
    expect(finalizeSource).toContain('createFileRoute("/api/oauth/finalize")');
    expect(finalizeSource).toContain("nativeFinalizeRequestSchema");
    expect(finalizeSource).toContain("nativeSessionMetadataSchema");
    expect(finalizeSource).toContain("finalize");
    expect(nativeServerSource).toContain("createCallerFactory(appRouter)");
    expect(nativeServerSource).toContain("createTRPCContext");
    expect(nativeServerSource).toContain("NATIVE_AUTH_HEADERS.client");
    expect(nativeServerSource).toContain("getHTTPStatusCodeFromError");
    expect(nativeServerSource).toContain("Unexpected auth error");

    for (const routeSource of [
      configSource,
      finalizeSource,
      nativeServerSource,
    ]) {
      expect(routeSource).not.toContain("next/");
      expect(routeSource).not.toContain("server-only");
      expect(routeSource).not.toContain('"use server"');
    }
  });
});
