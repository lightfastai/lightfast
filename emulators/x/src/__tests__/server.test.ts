import { createHash } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { X_EMULATOR_FIXTURES, X_EMULATOR_OAUTH_CODE } from "../fixtures";
import { type StartedXEmulator, startXEmulator } from "../server";

const VERIFIER = "x_pkce_verifier_lightfast_local_0123456789";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const REDIRECT_URI = "https://app.lightfast.localhost/api/connectors/x/callback";

let emulator: StartedXEmulator | undefined;

async function start() {
  emulator = await startXEmulator({ port: 0 });
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

async function authorize(extra: Record<string, string> = {}) {
  const active = emulator ?? (await start());
  const url = new URL("/oauth2/authorize", active.url);
  url.searchParams.set("client_id", X_EMULATOR_FIXTURES.oauthClientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code_challenge", CHALLENGE);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", "state_123");
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, value);
  }
  return await fetch(url, { redirect: "manual" });
}

afterEach(async () => {
  await emulator?.close();
  emulator = undefined;
});

describe("@repo/x-emulator", () => {
  it("completes the OAuth 2.0 PKCE authorization code flow", async () => {
    const authorizeRes = await authorize();
    expect(authorizeRes.status).toBe(302);

    const redirectUrl = new URL(authorizeRes.headers.get("location") ?? "");
    expect(redirectUrl.searchParams.get("code")).toBe(X_EMULATOR_OAUTH_CODE);
    expect(redirectUrl.searchParams.get("state")).toBe("state_123");

    const tokenRes = await postForm("/oauth2/token", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      code: X_EMULATOR_OAUTH_CODE,
      code_verifier: VERIFIER,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    });
    expect(tokenRes.status).toBe(200);
    await expect(tokenRes.json()).resolves.toMatchObject({
      access_token: X_EMULATOR_FIXTURES.accessToken,
      refresh_token: X_EMULATOR_FIXTURES.refreshToken,
      token_type: "bearer",
      expires_in: 7200,
    });
  });

  it("rejects a token exchange with an invalid PKCE verifier", async () => {
    await authorize();
    const res = await postForm("/oauth2/token", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      code: X_EMULATOR_OAUTH_CODE,
      code_verifier: "wrong-verifier",
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_grant" });
  });

  it("rejects an authorize request missing the PKCE challenge", async () => {
    const active = await start();
    const url = new URL("/oauth2/authorize", active.url);
    url.searchParams.set("client_id", X_EMULATOR_FIXTURES.oauthClientId);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    const res = await fetch(url, { redirect: "manual" });
    expect(res.status).toBe(400);
  });

  it("refreshes tokens and supports a forced refresh failure", async () => {
    const active = await start();

    const refreshRes = await postForm("/oauth2/token", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      grant_type: "refresh_token",
      refresh_token: X_EMULATOR_FIXTURES.refreshToken,
    });
    expect(refreshRes.status).toBe(200);

    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ refresh: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const failedRes = await postForm("/oauth2/token", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      grant_type: "refresh_token",
      refresh_token: X_EMULATOR_FIXTURES.refreshToken,
    });
    expect(failedRes.status).toBe(400);
  });

  it("serves the authenticated user and revokes valid tokens", async () => {
    const active = await start();
    const authorization = `Bearer ${X_EMULATOR_FIXTURES.accessToken}`;

    const meRes = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization },
    });
    expect(meRes.status).toBe(200);
    await expect(meRes.json()).resolves.toMatchObject({
      data: {
        id: X_EMULATOR_FIXTURES.userId,
        username: X_EMULATOR_FIXTURES.username,
      },
    });

    const revokeRes = await postForm("/oauth2/revoke", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      token: X_EMULATOR_FIXTURES.accessToken,
    });
    expect(revokeRes.status).toBe(200);
  });

  it("rejects missing and invalid bearer tokens on /2/users/me", async () => {
    const active = await start();

    const missingRes = await fetch(`${active.url}/2/users/me`);
    expect(missingRes.status).toBe(401);

    const invalidRes = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization: "Bearer invalid-token" },
    });
    expect(invalidRes.status).toBe(401);
  });

  it("supports the accessTokenExpired switch and reset", async () => {
    const active = await start();
    const authorization = `Bearer ${X_EMULATOR_FIXTURES.accessToken}`;

    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ accessTokenExpired: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const expiredRes = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization },
    });
    expect(expiredRes.status).toBe(401);

    const resetRes = await fetch(`${active.url}/reset`, { method: "POST" });
    expect(resetRes.status).toBe(200);

    const okRes = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization },
    });
    expect(okRes.status).toBe(200);
  });

  it("supports the usersMe failure switch", async () => {
    const active = await start();
    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ usersMe: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const res = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization: `Bearer ${X_EMULATOR_FIXTURES.accessToken}` },
    });
    expect(res.status).toBe(500);
  });

  it("rejects non-boolean failure switch values", async () => {
    const active = await start();
    const res = await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ refresh: "false" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_failure_switch",
      field: "refresh",
    });
  });
});
