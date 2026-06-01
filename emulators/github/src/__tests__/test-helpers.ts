import { createHash, createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { expect } from "vitest";

import { GITHUB_EMULATOR_FIXTURES } from "../fixtures";
import { type StartGitHubEmulatorInput, startGitHubEmulator } from "../plugin";

const TEST_PORT_MIN = 40_000;
const TEST_PORT_SPAN = 10_000;
const TEST_PORT_ATTEMPTS = 20;

function getRandomTestPort() {
  return TEST_PORT_MIN + Math.floor(Math.random() * TEST_PORT_SPAN);
}

function isAddrInUse(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EADDRINUSE"
  );
}

export async function startGitHubEmulatorOnAvailablePort(
  input: Omit<StartGitHubEmulatorInput, "port"> = {}
) {
  let lastAddrInUseError: NodeJS.ErrnoException | undefined;

  for (let attempt = 0; attempt < TEST_PORT_ATTEMPTS; attempt += 1) {
    try {
      return await startGitHubEmulator({
        ...input,
        port: getRandomTestPort(),
      });
    } catch (error) {
      if (!isAddrInUse(error)) {
        throw error;
      }
      lastAddrInUseError = error;
    }
  }

  throw (
    lastAddrInUseError ??
    new Error("Failed to start GitHub emulator on an available local port")
  );
}

export async function createAppJwt() {
  const key = createPrivateKey(GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey);
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(String(GITHUB_EMULATOR_FIXTURES.githubAppId))
    .sign(key);
}

export function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function appCallbackUrl(path = "/api/github/oauth/callback") {
  return new URL(path, "https://lightfast.localhost").toString();
}

export function userAccountCallbackUrl() {
  return appCallbackUrl("/api/github/user/oauth/callback");
}

export async function authorizeOAuthCode(
  emulatorUrl: string,
  codeVerifier: string,
  input: {
    redirectUri?: string;
    state?: string;
  } = {}
) {
  const redirectUri = input.redirectUri ?? appCallbackUrl();
  const state = input.state ?? "oauth_state_123";
  const authorizeUrl = new URL(`${emulatorUrl}/login/oauth/authorize`);
  authorizeUrl.searchParams.set(
    "client_id",
    GITHUB_EMULATOR_FIXTURES.oauthClientId
  );
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set(
    "code_challenge",
    createCodeChallenge(codeVerifier)
  );
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });
  expect(authorizeRes.status).toBe(302);
  const callback = new URL(authorizeRes.headers.get("location") ?? "");
  expect(callback.origin + callback.pathname).toBe(redirectUri);
  expect(callback.searchParams.get("state")).toBe(state);
  const code = callback.searchParams.get("code");
  expect(code).toEqual(expect.any(String));
  return code ?? "";
}

export async function exchangeOAuthCode(
  emulatorUrl: string,
  code: string,
  codeVerifier: string,
  input: {
    redirectUri?: string;
  } = {}
) {
  return await fetch(`${emulatorUrl}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
      client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: input.redirectUri ?? appCallbackUrl(),
    }),
  });
}

export async function mintOAuthToken(emulatorUrl: string) {
  const codeVerifier = "verifier_123456789012345678901234567890";
  const code = await authorizeOAuthCode(emulatorUrl, codeVerifier);
  const tokenRes = await exchangeOAuthCode(emulatorUrl, code, codeVerifier);
  expect(tokenRes.status).toBe(200);
  const body = (await tokenRes.json()) as { access_token?: string };
  expect(body).toMatchObject({
    access_token: expect.stringMatching(/^gho_/),
    token_type: "bearer",
  });
  return body.access_token ?? "";
}
