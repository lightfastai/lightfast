import { afterEach, describe, expect, it } from "vitest";

import {
  LINEAR_EMULATOR_FIXTURES,
  LINEAR_EMULATOR_TOOLS,
} from "../fixtures";
import {
  type StartedLinearEmulator,
  startLinearEmulator,
} from "../server";

let emulator: StartedLinearEmulator | undefined;

async function start() {
  emulator = await startLinearEmulator({ port: 0 });
  return emulator;
}

async function postForm(path: string, body: Record<string, string>) {
  const active = emulator ?? (await start());
  return await fetch(`${active.url}${path}`, {
    body: new URLSearchParams(body),
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
}

async function postJson(
  path: string,
  body: unknown,
  accessToken: string = LINEAR_EMULATOR_FIXTURES.accessToken
) {
  const active = emulator ?? (await start());
  return await fetch(`${active.url}${path}`, {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
}

async function exchangeCode(code: string) {
  return await postForm("/oauth/token", {
    client_id: LINEAR_EMULATOR_FIXTURES.oauthClientId,
    client_secret: LINEAR_EMULATOR_FIXTURES.oauthClientSecret,
    code,
    code_verifier: "verifier",
    grant_type: "authorization_code",
    redirect_uri: "https://app.lightfast.localhost/api/connectors/linear/callback",
  });
}

afterEach(async () => {
  await emulator?.close();
  emulator = undefined;
});

describe("@repo/linear-emulator", () => {
  it("completes the OAuth authorization code flow", async () => {
    const active = await start();
    const authorizeUrl = new URL("/oauth/authorize", active.url);
    authorizeUrl.searchParams.set(
      "client_id",
      LINEAR_EMULATOR_FIXTURES.oauthClientId
    );
    authorizeUrl.searchParams.set(
      "redirect_uri",
      "https://app.lightfast.localhost/api/connectors/linear/callback"
    );
    authorizeUrl.searchParams.set("state", "state_123");

    const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });

    expect(authorizeRes.status).toBe(302);
    const redirectUrl = new URL(authorizeRes.headers.get("location") ?? "");
    expect(redirectUrl.searchParams.get("code")).toBe(
      "linear_oauth_code_lightfast_local"
    );
    expect(redirectUrl.searchParams.get("state")).toBe("state_123");

    const tokenRes = await exchangeCode(
      redirectUrl.searchParams.get("code") ?? ""
    );

    expect(tokenRes.status).toBe(200);
    await expect(tokenRes.json()).resolves.toMatchObject({
      access_token: LINEAR_EMULATOR_FIXTURES.accessToken,
      expires_in: 3600,
      refresh_token: LINEAR_EMULATOR_FIXTURES.refreshToken,
      refresh_token_expires_in: 2_592_000,
      scope: "read,write",
      token_type: "Bearer",
    });
  });

  it("rejects invalid OAuth client credentials", async () => {
    await start();

    const res = await postForm("/oauth/token", {
      client_id: LINEAR_EMULATOR_FIXTURES.oauthClientId,
      client_secret: "wrong-secret",
      code: "linear_oauth_code_lightfast_local",
      grant_type: "authorization_code",
      redirect_uri: "https://app.lightfast.localhost/api/connectors/linear/callback",
    });

    expect(res.status).toBe(401);
  });

  it("refreshes tokens and supports forced refresh failure", async () => {
    const active = await start();

    const refreshRes = await postForm("/oauth/token", {
      client_id: LINEAR_EMULATOR_FIXTURES.oauthClientId,
      client_secret: LINEAR_EMULATOR_FIXTURES.oauthClientSecret,
      grant_type: "refresh_token",
      refresh_token: LINEAR_EMULATOR_FIXTURES.refreshToken,
    });
    expect(refreshRes.status).toBe(200);
    await expect(refreshRes.json()).resolves.toMatchObject({
      access_token: LINEAR_EMULATOR_FIXTURES.accessToken,
      refresh_token: LINEAR_EMULATOR_FIXTURES.refreshToken,
    });

    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ refresh: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const failedRefreshRes = await postForm("/oauth/token", {
      client_id: LINEAR_EMULATOR_FIXTURES.oauthClientId,
      client_secret: LINEAR_EMULATOR_FIXTURES.oauthClientSecret,
      grant_type: "refresh_token",
      refresh_token: LINEAR_EMULATOR_FIXTURES.refreshToken,
    });

    expect(failedRefreshRes.status).toBe(400);
  });

  it("serves viewer metadata through REST and GraphQL and revokes valid tokens", async () => {
    const active = await start();
    const authorization = `Bearer ${LINEAR_EMULATOR_FIXTURES.accessToken}`;

    const viewerRes = await fetch(`${active.url}/viewer`, {
      headers: { authorization },
    });
    expect(viewerRes.status).toBe(200);
    await expect(viewerRes.json()).resolves.toMatchObject({
      data: {
        viewer: {
          id: LINEAR_EMULATOR_FIXTURES.actorId,
          name: LINEAR_EMULATOR_FIXTURES.actorName,
          organization: {
            id: LINEAR_EMULATOR_FIXTURES.workspaceId,
            name: LINEAR_EMULATOR_FIXTURES.workspaceName,
          },
        },
      },
    });

    const graphqlRes = await fetch(`${active.url}/graphql`, {
      body: JSON.stringify({ query: "query { viewer { id name } }" }),
      headers: {
        authorization,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(graphqlRes.status).toBe(200);
    await expect(graphqlRes.json()).resolves.toMatchObject({
      data: {
        viewer: {
          organization: {
            id: LINEAR_EMULATOR_FIXTURES.workspaceId,
          },
        },
      },
    });

    const revokeRes = await postForm("/oauth/revoke", {
      client_id: LINEAR_EMULATOR_FIXTURES.oauthClientId,
      client_secret: LINEAR_EMULATOR_FIXTURES.oauthClientSecret,
      token: LINEAR_EMULATOR_FIXTURES.accessToken,
    });
    expect(revokeRes.status).toBe(200);
  });

  it("rejects missing and invalid MCP bearer tokens", async () => {
    const active = await start();

    const missingRes = await fetch(`${active.url}/mcp`, {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(missingRes.status).toBe(401);

    const invalidRes = await postJson(
      "/mcp",
      { id: 1, jsonrpc: "2.0", method: "tools/list" },
      "invalid-token"
    );
    expect(invalidRes.status).toBe(401);
  });

  it("lists deterministic MCP tools for a valid bearer token", async () => {
    await start();

    const res = await postJson("/mcp", {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/list",
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: 1,
      jsonrpc: "2.0",
      result: { tools: LINEAR_EMULATOR_TOOLS },
    });
  });

  it("supports a deterministic MCP list-tools failure switch", async () => {
    const active = await start();
    await exchangeCode("linear_oauth_code_lightfast_local");
    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ mcpListTools: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await postJson("/mcp", {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/list",
    });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: -32_003, message: "Linear MCP list-tools failure" },
      id: 1,
      jsonrpc: "2.0",
    });
  });

  it("resets failure switches", async () => {
    const active = await start();
    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({
        accessTokenExpired: true,
        mcpListTools: true,
        refresh: true,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const expiredRes = await fetch(`${active.url}/viewer`, {
      headers: {
        authorization: `Bearer ${LINEAR_EMULATOR_FIXTURES.accessToken}`,
      },
    });
    expect(expiredRes.status).toBe(401);

    const resetRes = await fetch(`${active.url}/reset`, { method: "POST" });
    expect(resetRes.status).toBe(200);

    const viewerRes = await fetch(`${active.url}/viewer`, {
      headers: {
        authorization: `Bearer ${LINEAR_EMULATOR_FIXTURES.accessToken}`,
      },
    });
    expect(viewerRes.status).toBe(200);
    await expect(viewerRes.json()).resolves.toMatchObject({
      data: {
        viewer: {
          id: LINEAR_EMULATOR_FIXTURES.actorId,
          name: LINEAR_EMULATOR_FIXTURES.actorName,
          organization: {
            id: LINEAR_EMULATOR_FIXTURES.workspaceId,
            name: LINEAR_EMULATOR_FIXTURES.workspaceName,
          },
        },
      },
    });
  });
});
