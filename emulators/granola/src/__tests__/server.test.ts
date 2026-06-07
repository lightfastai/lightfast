import { createHash } from "node:crypto";

import {
  GranolaOAuthClientProvider,
  granolaClientMetadata,
  listGranolaMcpTools,
} from "@repo/granola-app-node";
import { StreamableHTTPClientTransport } from "@vendor/mcp";
import { afterEach, describe, expect, it } from "vitest";

import { renderGranolaMcpPage } from "../plugin/mcp-ui";
import { type StartedGranolaEmulator, startGranolaEmulator } from "../server";

const CALLBACK_URL =
  "https://app.example.test/api/connectors/granola/oauth/callback";
const GRANOLA_ACCESS_TOKEN = "granola_access_valid";
const GRANOLA_REFRESH_TOKEN = "granola_refresh_valid";
const GRANOLA_CLIENT_ID = "granola_emulator_local";
const GRANOLA_OAUTH_CODE = "granola_oauth_code_emulator_local";
const GRANOLA_TOOLS = [
  {
    name: "search_notes",
    description: "Search emulated Granola meeting notes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "get_note",
    description: "Get an emulated Granola note",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

let emulator: StartedGranolaEmulator | undefined;

async function start() {
  emulator = await startGranolaEmulator({ port: 0 });
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
  accessToken = GRANOLA_ACCESS_TOKEN
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

function pkceChallengeFromVerifier(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function registerClient() {
  const active = emulator ?? (await start());
  return await fetch(`${active.url}/oauth/register`, {
    body: JSON.stringify({
      client_name: "Lightfast",
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: [CALLBACK_URL],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    method: "POST",
  });
}

async function exchangeCode(code: string) {
  return await postForm("/oauth/token", {
    client_id: GRANOLA_CLIENT_ID,
    code,
    code_verifier: "verifier",
    grant_type: "authorization_code",
    redirect_uri: CALLBACK_URL,
  });
}

afterEach(async () => {
  await emulator?.close();
  emulator = undefined;
});

describe("@repo/granola-emulator", () => {
  it("escapes dynamic values in the MCP setup page", () => {
    const html = renderGranolaMcpPage(
      'https://granola.example.test/mcp?next=<script>&quote="value"'
    );

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;quote=&quot;value&quot;");
    expect(html).not.toContain("<script>");
  });

  it("registers a public OAuth client and completes the authorization code flow", async () => {
    const active = await start();

    const registrationRes = await registerClient();
    expect(registrationRes.status).toBe(201);
    await expect(registrationRes.json()).resolves.toMatchObject({
      client_id: GRANOLA_CLIENT_ID,
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: [CALLBACK_URL],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });

    const authorizeUrl = new URL("/oauth/authorize", active.url);
    authorizeUrl.searchParams.set("client_id", GRANOLA_CLIENT_ID);
    authorizeUrl.searchParams.set(
      "code_challenge",
      pkceChallengeFromVerifier("verifier")
    );
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("redirect_uri", CALLBACK_URL);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("state", "state_123");

    const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });

    expect(authorizeRes.status).toBe(302);
    const redirectUrl = new URL(authorizeRes.headers.get("location") ?? "");
    expect(redirectUrl.searchParams.get("code")).toBe(GRANOLA_OAUTH_CODE);
    expect(redirectUrl.searchParams.get("state")).toBe("state_123");

    const tokenRes = await exchangeCode(
      redirectUrl.searchParams.get("code") ?? ""
    );

    expect(tokenRes.status).toBe(200);
    await expect(tokenRes.json()).resolves.toMatchObject({
      access_token: GRANOLA_ACCESS_TOKEN,
      expires_in: 3600,
      refresh_token: GRANOLA_REFRESH_TOKEN,
      scope: "notes:read meetings:read",
      token_type: "Bearer",
    });
  });

  it("rejects authorization code replay after a successful token exchange", async () => {
    const active = await start();
    await registerClient();

    const authorizeUrl = new URL("/oauth/authorize", active.url);
    authorizeUrl.searchParams.set("client_id", GRANOLA_CLIENT_ID);
    authorizeUrl.searchParams.set(
      "code_challenge",
      pkceChallengeFromVerifier("verifier")
    );
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("redirect_uri", CALLBACK_URL);
    authorizeUrl.searchParams.set("response_type", "code");

    const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });
    const redirectUrl = new URL(authorizeRes.headers.get("location") ?? "");
    const code = redirectUrl.searchParams.get("code") ?? "";

    const tokenRes = await exchangeCode(code);
    expect(tokenRes.status).toBe(200);

    const replayRes = await exchangeCode(code);
    expect(replayRes.status).toBe(400);
    await expect(replayRes.json()).resolves.toMatchObject({
      error: "invalid_grant",
    });
  });

  it("refreshes tokens and supports forced refresh failure", async () => {
    const active = await start();
    await registerClient();

    const refreshRes = await postForm("/oauth/token", {
      client_id: GRANOLA_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: GRANOLA_REFRESH_TOKEN,
    });
    expect(refreshRes.status).toBe(200);
    await expect(refreshRes.json()).resolves.toMatchObject({
      access_token: GRANOLA_ACCESS_TOKEN,
      refresh_token: GRANOLA_REFRESH_TOKEN,
    });

    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ refresh: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const failedRefreshRes = await postForm("/oauth/token", {
      client_id: GRANOLA_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: GRANOLA_REFRESH_TOKEN,
    });

    expect(failedRefreshRes.status).toBe(400);
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
    expect(missingRes.headers.get("www-authenticate")).toContain("Bearer");

    const invalidRes = await postJson(
      "/mcp",
      { id: 1, jsonrpc: "2.0", method: "tools/list" },
      "invalid-token"
    );
    expect(invalidRes.status).toBe(401);

    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ accessTokenExpired: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const expiredRes = await postJson("/mcp", {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/list",
    });
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.headers.get("www-authenticate")).toContain("Bearer");
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
      result: { tools: GRANOLA_TOOLS },
    });
  });

  it("returns deterministic Granola note content from MCP tool calls", async () => {
    await start();

    const searchRes = await postJson("/mcp", {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "search_notes",
        arguments: { query: "connectors" },
      },
    });

    expect(searchRes.status).toBe(200);
    await expect(searchRes.json()).resolves.toMatchObject({
      id: 1,
      jsonrpc: "2.0",
      result: {
        structuredContent: {
          notes: [
            expect.objectContaining({
              id: "granola_note_connectors",
              title: "User-first connector planning",
            }),
          ],
        },
      },
    });

    const getRes = await postJson("/mcp", {
      id: 2,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_note",
        arguments: { id: "granola_note_connectors" },
      },
    });

    expect(getRes.status).toBe(200);
    await expect(getRes.json()).resolves.toMatchObject({
      id: 2,
      jsonrpc: "2.0",
      result: {
        structuredContent: {
          note: expect.objectContaining({
            body: expect.stringContaining(
              "Granola remains a private user connector"
            ),
            id: "granola_note_connectors",
          }),
        },
      },
    });
  });

  it("supports the real Granola MCP client auth and tool-listing flow", async () => {
    const active = await start();
    let authorizationUrl: URL | undefined;
    const provider = new GranolaOAuthClientProvider({
      clientMetadata: granolaClientMetadata({ redirectUrl: CALLBACK_URL }),
      onAuthorizationUrl: (url) => {
        authorizationUrl = new URL(url.toString());
      },
      redirectUrl: CALLBACK_URL,
    });

    await expect(
      listGranolaMcpTools({
        authProvider: provider,
        endpoint: `${active.url}/mcp`,
        timeoutMs: 3000,
      })
    ).rejects.toMatchObject({
      code: "GRANOLA_MCP_AUTH_REQUIRED",
    });

    expect(provider.snapshot().clientInformation).toMatchObject({
      client_id: GRANOLA_CLIENT_ID,
    });
    expect(provider.snapshot().codeVerifier).toEqual(expect.any(String));
    expect(authorizationUrl?.pathname).toBe("/oauth/authorize");

    const authorizeRes = await fetch(authorizationUrl ?? "", {
      redirect: "manual",
    });
    expect(authorizeRes.status).toBe(302);
    const redirectUrl = new URL(authorizeRes.headers.get("location") ?? "");

    const transport = new StreamableHTTPClientTransport(
      new URL(`${active.url}/mcp`),
      {
        authProvider: provider,
      }
    );
    await transport.finishAuth(redirectUrl.searchParams.get("code") ?? "");

    expect(provider.snapshot().tokens).toMatchObject({
      access_token: GRANOLA_ACCESS_TOKEN,
      refresh_token: GRANOLA_REFRESH_TOKEN,
    });
    await expect(
      listGranolaMcpTools({
        authProvider: provider,
        endpoint: `${active.url}/mcp`,
        timeoutMs: 3000,
      })
    ).resolves.toEqual(GRANOLA_TOOLS);
  });
});
