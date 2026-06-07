import { createHash } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { X_EMULATOR_FIXTURES, X_EMULATOR_OAUTH_CODE } from "../fixtures";
import { xManifest } from "../manifest";
import { type StartedXEmulator, startXEmulator } from "../server";

const VERIFIER = "x_pkce_verifier_emulator_local_0123456789";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const REDIRECT_URI = "https://app.example.test/api/connectors/x/callback";

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

async function authorize(
  extra: Record<string, string> = {},
  path = "/oauth2/authorize"
) {
  const active = emulator ?? (await start());
  const url = new URL(path, active.url);
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

async function getAuthed(path: string) {
  const active = emulator ?? (await start());
  return await fetch(`${active.url}${path}`, {
    headers: {
      authorization: `Bearer ${X_EMULATOR_FIXTURES.accessToken}`,
    },
  });
}

async function writeJsonAuthed(
  method: "DELETE" | "POST" | "PUT",
  path: string,
  body: Record<string, unknown> = {}
) {
  const active = emulator ?? (await start());
  return await fetch(`${active.url}${path}`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${X_EMULATOR_FIXTURES.accessToken}`,
      "content-type": "application/json",
    },
    method,
  });
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

  it("serves token exchange and revoke under the X API OAuth path shape", async () => {
    await authorize();

    const tokenRes = await postForm("/2/oauth2/token", {
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
    });

    const revokeRes = await postForm("/2/oauth2/revoke", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      token: X_EMULATOR_FIXTURES.accessToken,
    });
    expect(revokeRes.status).toBe(200);
  });

  it("serves the X OAuth authorize path shape", async () => {
    const authorizeRes = await authorize({}, "/i/oauth2/authorize");
    expect(authorizeRes.status).toBe(302);

    const redirectUrl = new URL(authorizeRes.headers.get("location") ?? "");
    expect(redirectUrl.searchParams.get("code")).toBe(X_EMULATOR_OAUTH_CODE);
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

  it("serves authenticated read-only X user lookup endpoints", async () => {
    const byUsernameRes = await getAuthed("/2/users/by/username/emulator");
    expect(byUsernameRes.status).toBe(200);
    await expect(byUsernameRes.json()).resolves.toMatchObject({
      data: { id: "x_user_1", username: "emulator" },
    });

    const byUsernamesRes = await getAuthed(
      "/2/users/by?usernames=emulator,agent"
    );
    expect(byUsernamesRes.status).toBe(200);
    await expect(byUsernamesRes.json()).resolves.toMatchObject({
      data: [
        { id: "x_user_1", username: "emulator" },
        { id: "x_user_2", username: "agent" },
      ],
    });

    const byIdRes = await getAuthed("/2/users/x_user_1");
    expect(byIdRes.status).toBe(200);
    await expect(byIdRes.json()).resolves.toMatchObject({
      data: { id: "x_user_1", username: "emulator" },
    });

    const byIdsRes = await getAuthed("/2/users?ids=x_user_1,x_user_2");
    expect(byIdsRes.status).toBe(200);
    await expect(byIdsRes.json()).resolves.toMatchObject({
      data: [
        { id: "x_user_1", username: "emulator" },
        { id: "x_user_2", username: "agent" },
      ],
    });
  });

  it("serves authenticated read-only X post endpoints", async () => {
    const byIdRes = await getAuthed("/2/tweets/tweet_1");
    expect(byIdRes.status).toBe(200);
    await expect(byIdRes.json()).resolves.toMatchObject({
      data: { author_id: "x_user_1", id: "tweet_1" },
    });

    const byIdsRes = await getAuthed("/2/tweets?ids=tweet_1,tweet_2");
    expect(byIdsRes.status).toBe(200);
    await expect(byIdsRes.json()).resolves.toMatchObject({
      data: [{ id: "tweet_1" }, { id: "tweet_2" }],
    });

    const searchRes = await getAuthed("/2/tweets/search/recent?query=emulator");
    expect(searchRes.status).toBe(200);
    await expect(searchRes.json()).resolves.toMatchObject({
      data: [{ id: "tweet_1" }],
    });

    const countsRes = await getAuthed("/2/tweets/counts/recent?query=emulator");
    expect(countsRes.status).toBe(200);
    await expect(countsRes.json()).resolves.toMatchObject({
      data: [{ tweet_count: 1 }],
    });
  });

  it("rejects missing bearer tokens on read-only lookup endpoints", async () => {
    const active = await start();
    const res = await fetch(`${active.url}/2/tweets/tweet_1`);
    expect(res.status).toBe(401);
  });

  it("serves authenticated X social write endpoints", async () => {
    const createPostRes = await writeJsonAuthed("POST", "/2/tweets", {
      text: "ship it",
    });
    expect(createPostRes.status).toBe(200);
    await expect(createPostRes.json()).resolves.toMatchObject({
      data: { id: expect.stringMatching(/^tweet_/), text: "ship it" },
    });

    const deletePostRes = await writeJsonAuthed("DELETE", "/2/tweets/tweet_1");
    expect(deletePostRes.status).toBe(200);
    await expect(deletePostRes.json()).resolves.toMatchObject({
      data: { deleted: true },
    });

    const likeRes = await writeJsonAuthed("POST", "/2/users/x_user_1/likes", {
      tweet_id: "tweet_1",
    });
    expect(likeRes.status).toBe(200);
    await expect(likeRes.json()).resolves.toMatchObject({
      data: { liked: true },
    });

    const unlikeRes = await writeJsonAuthed(
      "DELETE",
      "/2/users/x_user_1/likes/tweet_1"
    );
    expect(unlikeRes.status).toBe(200);
    await expect(unlikeRes.json()).resolves.toMatchObject({
      data: { liked: false },
    });

    const followRes = await writeJsonAuthed(
      "POST",
      "/2/users/x_user_1/following",
      { target_user_id: "x_user_2" }
    );
    expect(followRes.status).toBe(200);
    await expect(followRes.json()).resolves.toMatchObject({
      data: { following: true },
    });

    const listRes = await writeJsonAuthed("POST", "/2/lists", {
      name: "Launch list",
    });
    expect(listRes.status).toBe(200);
    await expect(listRes.json()).resolves.toMatchObject({
      data: { id: expect.stringMatching(/^list_/), name: "Launch list" },
    });

    const dmRes = await writeJsonAuthed(
      "POST",
      "/2/dm_conversations/with/x_user_2/messages",
      { text: "hello" }
    );
    expect(dmRes.status).toBe(200);
    await expect(dmRes.json()).resolves.toMatchObject({
      data: { dm_event_id: expect.stringMatching(/^dm_event_/) },
    });

    const noteRes = await writeJsonAuthed("POST", "/2/notes", {
      text: "context",
    });
    expect(noteRes.status).toBe(200);
    await expect(noteRes.json()).resolves.toMatchObject({
      data: { id: expect.stringMatching(/^note_/) },
    });
  });

  it("rejects missing bearer tokens on social write endpoints", async () => {
    const active = await start();
    const res = await fetch(`${active.url}/2/tweets`, {
      body: JSON.stringify({ text: "ship it" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("supports the socialWrite failure switch", async () => {
    const active = await start();
    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ socialWrite: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await writeJsonAuthed("POST", "/2/tweets", {
      text: "blocked",
    });
    expect(res.status).toBe(500);
  });

  it("emits the app-hosted X MCP endpoint in its manifest", () => {
    expect(
      xManifest.env({
        callbackUrl: "https://app.example.test/api/connectors/x/mcp",
        publicOrigin: "https://x.example.test",
      })
    ).toMatchObject({
      X_API_ORIGIN: "https://x.example.test",
      X_MCP_ENDPOINT: "https://app.example.test/api/connectors/x/mcp",
      X_OAUTH_ORIGIN: "https://x.example.test",
    });
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
