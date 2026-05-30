import { createHash, createPrivateKey } from "node:crypto";
import { Store } from "@emulators/core";
import {
  getGitHubStore,
  githubPlugin,
  seedFromConfig,
} from "@emulators/github";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createGitHubEmulatorSeed,
  formatGitHubEmulatorEnvString,
  GITHUB_EMULATOR_FIXTURES,
  getGitHubEmulatorEnv,
} from "../fixtures";
import { createGitHubCompatibleFetch } from "../github-compatible-routes";
import {
  addOrgMembership,
  type StartedGitHubEmulator,
  type StartGitHubEmulatorInput,
  startGitHubEmulator,
} from "../server";

let emulator: StartedGitHubEmulator | undefined;
let emulatorPort: number;

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

async function startGitHubEmulatorOnAvailablePort(
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

async function createAppJwt() {
  const key = createPrivateKey(GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey);
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(String(GITHUB_EMULATOR_FIXTURES.githubAppId))
    .sign(key);
}

function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function appCallbackUrl(path = "/api/github/oauth/callback") {
  return new URL(path, "https://lightfast.localhost").toString();
}

async function authorizeOAuthCode(codeVerifier: string) {
  const authorizeUrl = new URL(`${emulator?.url}/login/oauth/authorize`);
  authorizeUrl.searchParams.set(
    "client_id",
    GITHUB_EMULATOR_FIXTURES.oauthClientId
  );
  authorizeUrl.searchParams.set("redirect_uri", appCallbackUrl());
  authorizeUrl.searchParams.set("state", "oauth_state_123");
  authorizeUrl.searchParams.set(
    "code_challenge",
    createCodeChallenge(codeVerifier)
  );
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });
  expect(authorizeRes.status).toBe(302);
  const callback = new URL(authorizeRes.headers.get("location") ?? "");
  expect(callback.origin + callback.pathname).toBe(appCallbackUrl());
  expect(callback.searchParams.get("state")).toBe("oauth_state_123");
  const code = callback.searchParams.get("code");
  expect(code).toEqual(expect.any(String));
  return code ?? "";
}

async function exchangeOAuthCode(code: string, codeVerifier: string) {
  return await fetch(`${emulator?.url}/login/oauth/access_token`, {
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
      redirect_uri: appCallbackUrl(),
    }),
  });
}

async function mintOAuthToken() {
  const codeVerifier = "verifier_123456789012345678901234567890";
  const code = await authorizeOAuthCode(codeVerifier);
  const tokenRes = await exchangeOAuthCode(code, codeVerifier);
  expect(tokenRes.status).toBe(200);
  const body = (await tokenRes.json()) as { access_token?: string };
  expect(body).toMatchObject({
    access_token: expect.stringMatching(/^gho_/),
    token_type: "bearer",
  });
  return body.access_token ?? "";
}

beforeAll(async () => {
  emulator = await startGitHubEmulatorOnAvailablePort();
  emulatorPort = Number(new URL(emulator.url).port);
});

afterAll(async () => {
  await emulator?.close();
});

describe("@repo/github-emulator", () => {
  it("starts a seeded GitHub emulator on the fixed local origin", async () => {
    expect(emulator?.url).toBe(`http://127.0.0.1:${emulatorPort}`);
    expect(emulator?.listenUrl).toBe(`http://127.0.0.1:${emulatorPort}`);
    expect(emulator?.publicOrigin).toBe(`http://127.0.0.1:${emulatorPort}`);

    const res = await fetch(`${emulator?.url}/orgs/lightfast-emulated`);
    await expect(res.json()).resolves.toMatchObject({
      login: "lightfast-emulated",
      name: "Lightfast Emulated",
    });
  });

  it("seeds the GitHub App webhook URL from the Lightfast app origin", () => {
    const store = new Store();
    githubPlugin.seed?.(store, GITHUB_EMULATOR_FIXTURES.origin);
    seedFromConfig(
      store,
      GITHUB_EMULATOR_FIXTURES.origin,
      createGitHubEmulatorSeed("https://app.lightfast.localhost")
    );
    const gh = getGitHubStore(store);
    const app = gh.apps.findOneBy(
      "app_id",
      GITHUB_EMULATOR_FIXTURES.githubAppId
    );

    expect(app?.webhook_url).toBe(
      "https://app.lightfast.localhost/api/github/webhook"
    );
    expect(app?.webhook_secret).toBe(
      GITHUB_EMULATOR_FIXTURES.githubWebhookSecret
    );
  });

  it("seeds the OAuth user as a member of the GitHub org", async () => {
    const token = "test_token_lightfast";
    const res = await fetch(`${emulator?.url}/user/orgs`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ login: "lightfast-emulated" }),
      ])
    );
  });

  it("accepts a valid GitHub App JWT after the local patch", async () => {
    const jwt = await createAppJwt();
    const res = await fetch(`${emulator?.url}/app`, {
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: GITHUB_EMULATOR_FIXTURES.githubAppId,
      slug: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
    });
  });

  it("mints installation tokens for the seeded org installation", async () => {
    const jwt = await createAppJwt();
    const res = await fetch(
      `${emulator?.url}/app/installations/${GITHUB_EMULATOR_FIXTURES.installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${jwt}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      repository_selection: "all",
      token: expect.stringMatching(/^ghs_/),
    });
  });

  it("redirects GitHub App install requests to the Lightfast setup callback", async () => {
    const res = await fetch(
      `${emulator?.url}/apps/${GITHUB_EMULATOR_FIXTURES.githubAppSlug}/installations/new?state=install_state_123`,
      { redirect: "manual" }
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://lightfast.localhost/api/github/setup?installation_id=1001&setup_action=install&state=install_state_123"
    );
  });

  it("rejects install requests for an unknown GitHub App slug", async () => {
    const res = await fetch(
      `${emulator?.url}/apps/unknown/installations/new?state=install_state_123`,
      { redirect: "manual" }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ message: "Not Found" });
  });

  it("performs OAuth authorize and token exchange with PKCE", async () => {
    const codeVerifier = "verifier_123456789012345678901234567890";
    const code = await authorizeOAuthCode(codeVerifier);
    const tokenRes = await exchangeOAuthCode(code, codeVerifier);

    expect(tokenRes.status).toBe(200);
    await expect(tokenRes.json()).resolves.toMatchObject({
      access_token: expect.stringMatching(/^gho_/),
      token_type: "bearer",
    });
  });

  it("rejects bad PKCE verifiers and one-time OAuth code reuse", async () => {
    const codeVerifier = "verifier_123456789012345678901234567890";
    const code = await authorizeOAuthCode(codeVerifier);
    const badPkceRes = await exchangeOAuthCode(code, "wrong_verifier");
    expect(badPkceRes.status).toBe(200);
    await expect(badPkceRes.json()).resolves.toMatchObject({
      error: "bad_verification_code",
    });

    const firstGoodRes = await exchangeOAuthCode(code, codeVerifier);
    expect(firstGoodRes.status).toBe(200);
    await expect(firstGoodRes.json()).resolves.toMatchObject({
      error: "bad_verification_code",
    });

    const reusableCode = await authorizeOAuthCode(codeVerifier);
    const firstUseRes = await exchangeOAuthCode(reusableCode, codeVerifier);
    expect(firstUseRes.status).toBe(200);
    await expect(firstUseRes.json()).resolves.toMatchObject({
      access_token: expect.stringMatching(/^gho_/),
    });

    const secondUseRes = await exchangeOAuthCode(reusableCode, codeVerifier);
    expect(secondUseRes.status).toBe(200);
    await expect(secondUseRes.json()).resolves.toMatchObject({
      error: "bad_verification_code",
    });
  });

  it("returns the OAuth user and accessible app installations", async () => {
    const oauthToken = await mintOAuthToken();
    const userRes = await fetch(`${emulator?.url}/user`, {
      headers: {
        authorization: `Bearer ${oauthToken}`,
      },
    });

    expect(userRes.status).toBe(200);
    await expect(userRes.json()).resolves.toMatchObject({
      login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
    });

    const installationsRes = await fetch(
      `${emulator?.url}/user/installations`,
      {
        headers: {
          authorization: `Bearer ${oauthToken}`,
        },
      }
    );

    expect(installationsRes.status).toBe(200);
    await expect(installationsRes.json()).resolves.toMatchObject({
      total_count: 1,
      installations: [
        expect.objectContaining({
          id: GITHUB_EMULATOR_FIXTURES.installationId,
          account: expect.objectContaining({
            login: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
            type: "Organization",
          }),
          target_type: "Organization",
        }),
      ],
    });
  });

  it("rejects shared emulator tokens that were not minted by OAuth", async () => {
    const userRes = await fetch(`${emulator?.url}/user`, {
      headers: {
        authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
      },
    });
    expect(userRes.status).toBe(401);
    await expect(userRes.json()).resolves.toEqual({
      message: "Bad credentials",
    });

    const installationsRes = await fetch(
      `${emulator?.url}/user/installations`,
      {
        headers: {
          authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
        },
      }
    );
    expect(installationsRes.status).toBe(401);
    await expect(installationsRes.json()).resolves.toEqual({
      message: "Bad credentials",
    });
  });

  it("returns only installations for the OAuth app", async () => {
    const store = new Store();
    githubPlugin.seed?.(store, GITHUB_EMULATOR_FIXTURES.origin);
    seedFromConfig(
      store,
      GITHUB_EMULATOR_FIXTURES.origin,
      createGitHubEmulatorSeed()
    );
    addOrgMembership(store);
    const gh = getGitHubStore(store);
    const org = gh.orgs.findOneBy(
      "login",
      GITHUB_EMULATOR_FIXTURES.githubOrgLogin
    );
    const user = gh.users.findOneBy(
      "login",
      GITHUB_EMULATOR_FIXTURES.githubUserLogin
    );
    expect(org).toBeDefined();
    expect(user).toBeDefined();
    const secondApp = gh.apps.insert({
      app_id: 999_999,
      slug: "other-local-app",
      name: "Other Local App",
      private_key: GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey,
      permissions: { metadata: "read" },
      events: ["push"],
      webhook_url: null,
      webhook_secret: null,
      description: null,
    });
    gh.appInstallations.insert({
      installation_id: 2002,
      app_id: secondApp.app_id,
      account_type: "Organization",
      account_id: org?.id ?? 0,
      account_login: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
      repository_selection: "all",
      repository_ids: [],
      permissions: secondApp.permissions,
      events: secondApp.events,
      suspended_at: null,
    });
    const tokenMap = new Map();
    const fetchCompatible = createGitHubCompatibleFetch({
      appOrigin: "https://lightfast.localhost",
      fallbackFetch: () =>
        Response.json({ message: "fallback" }, { status: 418 }),
      publicOrigin: GITHUB_EMULATOR_FIXTURES.origin,
      store,
      tokenMap,
    });
    const codeVerifier = "verifier_123456789012345678901234567890";
    const authorizeUrl = new URL(
      `${GITHUB_EMULATOR_FIXTURES.origin}/login/oauth/authorize`
    );
    authorizeUrl.searchParams.set(
      "client_id",
      GITHUB_EMULATOR_FIXTURES.oauthClientId
    );
    authorizeUrl.searchParams.set("redirect_uri", appCallbackUrl());
    authorizeUrl.searchParams.set("state", "oauth_state_123");
    authorizeUrl.searchParams.set(
      "code_challenge",
      createCodeChallenge(codeVerifier)
    );
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    const authorizeRes = await fetchCompatible(new Request(authorizeUrl));
    expect(authorizeRes.status).toBe(302);
    const callback = new URL(authorizeRes.headers.get("location") ?? "");
    const tokenRes = await fetchCompatible(
      new Request(
        `${GITHUB_EMULATOR_FIXTURES.origin}/login/oauth/access_token`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
            client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
            code: callback.searchParams.get("code"),
            code_verifier: codeVerifier,
            redirect_uri: appCallbackUrl(),
          }),
        }
      )
    );
    expect(tokenRes.status).toBe(200);
    const tokenBody = (await tokenRes.json()) as { access_token?: string };
    expect(tokenBody.access_token).toEqual(expect.stringMatching(/^gho_/));

    const installationsRes = await fetchCompatible(
      new Request(`${GITHUB_EMULATOR_FIXTURES.origin}/user/installations`, {
        headers: { authorization: `Bearer ${tokenBody.access_token}` },
      })
    );
    expect(installationsRes.status).toBe(200);
    await expect(installationsRes.json()).resolves.toMatchObject({
      total_count: 1,
      installations: [
        expect.objectContaining({
          app_id: GITHUB_EMULATOR_FIXTURES.githubAppId,
          id: GITHUB_EMULATOR_FIXTURES.installationId,
        }),
      ],
    });
  });

  it("prints the env values consumed by app and api packages", () => {
    expect(getGitHubEmulatorEnv("https://lightfast.localhost")).toEqual(
      expect.objectContaining({
        GITHUB_APP_ENDPOINT_ORIGIN: GITHUB_EMULATOR_FIXTURES.origin,
        GITHUB_APP_ID: String(GITHUB_EMULATOR_FIXTURES.githubAppId),
        GITHUB_APP_SLUG: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
      })
    );
    expect(
      getGitHubEmulatorEnv("https://lightfast.localhost")
    ).not.toHaveProperty("GITHUB_INSTALL_URL_OVERRIDE");
  });

  it("starts with a distinct Portless public origin", async () => {
    const portlessEmulator = await startGitHubEmulatorOnAvailablePort({
      appOrigin: "https://feature.lightfast.localhost",
      publicOrigin: "https://feature.github.lightfast.localhost",
    });
    const portlessPort = Number(new URL(portlessEmulator.url).port);

    try {
      expect(portlessEmulator.url).toBe(`http://127.0.0.1:${portlessPort}`);
      expect(portlessEmulator.listenUrl).toBe(
        `http://127.0.0.1:${portlessPort}`
      );
      expect(portlessEmulator.publicOrigin).toBe(
        "https://feature.github.lightfast.localhost"
      );

      const res = await fetch(
        `${portlessEmulator.url}/orgs/lightfast-emulated`
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        login: "lightfast-emulated",
      });
    } finally {
      await portlessEmulator.close();
    }
  });

  it("formats quoted env assignments for eval-free runtime injection", () => {
    expect(
      formatGitHubEmulatorEnvString({
        GITHUB_APP_ID: "424242",
        GITHUB_APP_PRIVATE_KEY: "line1 line2\\nline3",
        GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
      })
    ).toBe(
      [
        "GITHUB_APP_ID='424242'",
        "GITHUB_APP_PRIVATE_KEY='line1 line2\\nline3'",
        "GITHUB_APP_ENDPOINT_ORIGIN='https://github.lightfast.localhost'",
      ].join("\n")
    );
  });

  it("rejects env assignments that cannot be safely passed through env -S", () => {
    expect(() =>
      formatGitHubEmulatorEnvString({
        "GITHUB APP ID": "424242",
      })
    ).toThrow(/Invalid environment variable name/);

    expect(() =>
      formatGitHubEmulatorEnvString({
        GITHUB_APP_PRIVATE_KEY: "line1\0line2",
      })
    ).toThrow(/contains a NUL byte/);
  });

  it("rejects when the requested port is already in use", async () => {
    await expect(
      startGitHubEmulator({ port: emulatorPort })
    ).rejects.toMatchObject({
      code: "EADDRINUSE",
    });
  });
});
