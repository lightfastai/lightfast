import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { Store } from "@emulators/core";
import {
  getGitHubStore,
  githubPlugin,
  seedFromConfig,
} from "@emulators/github";
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
  startGitHubEmulator,
} from "../server";
import {
  appCallbackUrl,
  authorizeOAuthCode,
  createAppJwt,
  createCodeChallenge,
  exchangeOAuthCode,
  mintOAuthToken,
  startGitHubEmulatorOnAvailablePort,
} from "./test-helpers";

let emulator: StartedGitHubEmulator | undefined;
let emulatorPort: number;

async function createInstallationToken() {
  const jwt = await createAppJwt();
  const tokenRes = await fetch(
    `${emulator?.url}/app/installations/${GITHUB_EMULATOR_FIXTURES.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    }
  );
  const tokenBody = (await tokenRes.json()) as { token?: string };
  expect(tokenBody.token).toEqual(expect.stringMatching(/^ghs_/));
  return tokenBody.token;
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
    const tokenBody = (await res.json()) as { token?: string };
    expect(tokenBody).toMatchObject({
      repository_selection: "all",
      token: expect.stringMatching(/^ghs_/),
    });

    const refRes = await fetch(
      `${emulator?.url}/repos/${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/${GITHUB_EMULATOR_FIXTURES.githubRepoName}/git/ref/heads/main`,
      {
        headers: {
          authorization: `Bearer ${tokenBody.token}`,
        },
      }
    );
    expect(refRes.status).toBe(200);
  });

  it("returns current app installation metadata with html_url", async () => {
    const jwt = await createAppJwt();
    const res = await fetch(
      `${emulator?.url}/app/installations/${GITHUB_EMULATOR_FIXTURES.installationId}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${jwt}`,
        },
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: GITHUB_EMULATOR_FIXTURES.installationId,
      account: expect.objectContaining({
        login: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
        type: "Organization",
      }),
      html_url: `${emulator?.url}/settings/installations/${GITHUB_EMULATOR_FIXTURES.installationId}`,
      target_type: "Organization",
    });
  });

  it("lists repositories accessible to an installation token", async () => {
    const token = await createInstallationToken();

    const res = await fetch(`${emulator?.url}/installation/repositories`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      total_count: 2,
      repositories: expect.arrayContaining([
        expect.objectContaining({
          full_name: `${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/${GITHUB_EMULATOR_FIXTURES.githubRepoName}`,
          name: GITHUB_EMULATOR_FIXTURES.githubRepoName,
          private: true,
        }),
        expect.objectContaining({
          full_name: `${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/api-service`,
          name: "api-service",
          private: false,
        }),
      ]),
    });
  });

  it("defaults invalid installation repository pagination parameters", async () => {
    const token = await createInstallationToken();

    const res = await fetch(
      `${emulator?.url}/installation/repositories?per_page=abc&page=abc`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
        },
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      total_count: 2,
      repositories: [
        expect.objectContaining({
          name: GITHUB_EMULATOR_FIXTURES.githubRepoName,
        }),
        expect.objectContaining({ name: "api-service" }),
      ],
    });
  });

  it("clamps and slices installation repository pagination", async () => {
    const token = await createInstallationToken();

    const clampedRes = await fetch(
      `${emulator?.url}/installation/repositories?per_page=0&page=0`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
        },
      }
    );

    expect(clampedRes.status).toBe(200);
    await expect(clampedRes.json()).resolves.toMatchObject({
      total_count: 2,
      repositories: [
        expect.objectContaining({
          name: GITHUB_EMULATOR_FIXTURES.githubRepoName,
        }),
      ],
    });

    const res = await fetch(
      `${emulator?.url}/installation/repositories?per_page=1&page=2`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
        },
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      total_count: 2,
      repositories: [expect.objectContaining({ name: "api-service" })],
    });
  });

  it("filters selected installation repositories", async () => {
    if (!emulator) {
      throw new Error("GitHub emulator was not started");
    }
    const gh = getGitHubStore(emulator.store);
    const installation = gh.appInstallations
      .all()
      .find(
        (candidate) =>
          candidate.installation_id === GITHUB_EMULATOR_FIXTURES.installationId
      );
    const repo = gh.repos.findOneBy("name", "api-service");
    expect(installation).toBeDefined();
    expect(repo).toBeDefined();
    gh.appInstallations.update(installation?.id ?? 0, {
      repository_selection: "selected",
      repository_ids: [repo?.id ?? 0],
    });

    try {
      const token = await createInstallationToken();

      const res = await fetch(`${emulator?.url}/installation/repositories`, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        total_count: 1,
        repositories: [expect.objectContaining({ name: "api-service" })],
      });
    } finally {
      emulator?.reset();
    }
  });

  it("rejects installation repository listing without an installation token", async () => {
    const res = await fetch(`${emulator?.url}/installation/repositories`, {
      headers: {
        authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
      },
    });

    expect(res.status).toBe(401);
  });

  it("can emulate the missing and satisfied .lightfast repository requirement", async () => {
    const jwt = await createAppJwt();
    const owner = GITHUB_EMULATOR_FIXTURES.githubOrgLogin;
    const missingRes = await fetch(
      `${emulator?.url}/repos/${owner}/.lightfast/installation`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${jwt}`,
        },
      }
    );
    expect(missingRes.status).toBe(404);

    const createRes = await fetch(`${emulator?.url}/orgs/${owner}/repos`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        auto_init: true,
        name: ".lightfast",
        private: true,
      }),
    });
    expect(createRes.status).toBe(201);

    const installationRes = await fetch(
      `${emulator?.url}/repos/${owner}/.lightfast/installation`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${jwt}`,
        },
      }
    );
    expect(installationRes.status).toBe(200);
    await expect(installationRes.json()).resolves.toMatchObject({
      id: GITHUB_EMULATOR_FIXTURES.installationId,
      repository_selection: "all",
    });
  });

  it("resets emulator state for repeatable local E2E runs", async () => {
    emulator?.reset();
    const owner = GITHUB_EMULATOR_FIXTURES.githubOrgLogin;
    const createRes = await fetch(`${emulator?.url}/orgs/${owner}/repos`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        auto_init: true,
        name: ".lightfast",
        private: true,
      }),
    });
    expect(createRes.status).toBe(201);

    const resetRes = await fetch(`${emulator?.url}/__lightfast/reset`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
      },
    });
    expect(resetRes.status).toBe(200);
    await expect(resetRes.json()).resolves.toEqual({
      ok: true,
      installationId: GITHUB_EMULATOR_FIXTURES.installationId,
      org: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
    });

    const jwt = await createAppJwt();
    const missingRes = await fetch(
      `${emulator?.url}/repos/${owner}/.lightfast/installation`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${jwt}`,
        },
      }
    );
    expect(missingRes.status).toBe(404);

    const installRes = await fetch(
      `${emulator?.url}/apps/${GITHUB_EMULATOR_FIXTURES.githubAppSlug}/installations/new?state=install_state_after_reset`,
      { redirect: "manual" }
    );
    expect(installRes.status).toBe(302);
    expect(installRes.headers.get("location")).toContain(
      "installation_id=1001"
    );
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
    const code = await authorizeOAuthCode(emulator?.url ?? "", codeVerifier);
    const tokenRes = await exchangeOAuthCode(
      emulator?.url ?? "",
      code,
      codeVerifier
    );

    expect(tokenRes.status).toBe(200);
    await expect(tokenRes.json()).resolves.toMatchObject({
      access_token: expect.stringMatching(/^gho_/),
      token_type: "bearer",
    });
  });

  it("rejects bad PKCE verifiers and one-time OAuth code reuse", async () => {
    const codeVerifier = "verifier_123456789012345678901234567890";
    const code = await authorizeOAuthCode(emulator?.url ?? "", codeVerifier);
    const badPkceRes = await exchangeOAuthCode(
      emulator?.url ?? "",
      code,
      "wrong_verifier"
    );
    expect(badPkceRes.status).toBe(200);
    await expect(badPkceRes.json()).resolves.toMatchObject({
      error: "bad_verification_code",
    });

    const firstGoodRes = await exchangeOAuthCode(
      emulator?.url ?? "",
      code,
      codeVerifier
    );
    expect(firstGoodRes.status).toBe(200);
    await expect(firstGoodRes.json()).resolves.toMatchObject({
      error: "bad_verification_code",
    });

    const reusableCode = await authorizeOAuthCode(
      emulator?.url ?? "",
      codeVerifier
    );
    const firstUseRes = await exchangeOAuthCode(
      emulator?.url ?? "",
      reusableCode,
      codeVerifier
    );
    expect(firstUseRes.status).toBe(200);
    await expect(firstUseRes.json()).resolves.toMatchObject({
      access_token: expect.stringMatching(/^gho_/),
    });

    const secondUseRes = await exchangeOAuthCode(
      emulator?.url ?? "",
      reusableCode,
      codeVerifier
    );
    expect(secondUseRes.status).toBe(200);
    await expect(secondUseRes.json()).resolves.toMatchObject({
      error: "bad_verification_code",
    });
  });

  it("returns the OAuth user and accessible app installations", async () => {
    const oauthToken = await mintOAuthToken(emulator?.url ?? "");
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
      resetStore: () => undefined,
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

  it("simulates a push through GitHub-compatible git APIs", async () => {
    const { pushGitHubEmulatorCommit } = await import("../push");
    const demoPath = "skills/demo/SKILL.md";
    const result = await pushGitHubEmulatorCommit({
      apiBaseUrl: emulator?.url ?? "",
      branch: "main",
      files: [
        {
          content: "# Demo\n",
          path: demoPath,
        },
      ],
      message: "Add demo skill",
      owner: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
      repo: GITHUB_EMULATOR_FIXTURES.githubRepoName,
      token: GITHUB_EMULATOR_FIXTURES.userToken,
    });

    expect(result.afterSha).toEqual(expect.any(String));
    expect(result.beforeSha).toEqual(expect.any(String));
    expect(result.afterSha).not.toBe(result.beforeSha);

    const commitRes = await fetch(
      `${emulator?.url}/repos/${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/${GITHUB_EMULATOR_FIXTURES.githubRepoName}/git/commits/${result.afterSha}`,
      {
        headers: {
          authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
        },
      }
    );
    expect(commitRes.status).toBe(200);
    const commit = (await commitRes.json()) as {
      commit?: { tree?: { sha?: string } };
    };
    const treeSha = commit.commit?.tree?.sha;
    expect(treeSha).toEqual(expect.any(String));

    const treeRes = await fetch(
      `${emulator?.url}/repos/${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/${GITHUB_EMULATOR_FIXTURES.githubRepoName}/git/trees/${treeSha}?recursive=1`,
      {
        headers: {
          authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
        },
      }
    );
    expect(treeRes.status).toBe(200);
    const tree = (await treeRes.json()) as {
      tree?: Array<{ path?: string; sha?: string; type?: string }>;
    };
    const demoEntry = tree.tree?.find((entry) => entry.path === demoPath);
    expect(demoEntry).toMatchObject({
      path: demoPath,
      sha: expect.any(String),
      type: "blob",
    });

    const blobRes = await fetch(
      `${emulator?.url}/repos/${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/${GITHUB_EMULATOR_FIXTURES.githubRepoName}/git/blobs/${demoEntry?.sha}`,
      {
        headers: {
          authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}`,
        },
      }
    );
    expect(blobRes.status).toBe(200);
    const blob = (await blobRes.json()) as {
      content?: string;
      encoding?: string;
    };
    expect(blob.encoding).toBe("base64");
    expect(Buffer.from(blob.content ?? "", "base64").toString("utf8")).toBe(
      "# Demo\n"
    );
  });

  it("delivers a signed GitHub App push webhook after simulated push", async () => {
    const received: Array<{
      body: string;
      event: string | null;
      signature: string | null;
    }> = [];
    let resolveWebhook: (() => void) | undefined;
    const webhookReceived = new Promise<void>((resolve) => {
      resolveWebhook = resolve;
    });
    const receiver = await new Promise<{
      close: () => Promise<void>;
      url: string;
    }>((resolve, reject) => {
      const server = createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          received.push({
            body: Buffer.concat(chunks).toString("utf8"),
            event: req.headers["x-github-event"]?.toString() ?? null,
            signature: req.headers["x-hub-signature-256"]?.toString() ?? null,
          });
          resolveWebhook?.();
          res.statusCode = 202;
          res.end("ok");
        });
      });
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        const address = server.address();
        if (typeof address !== "object" || !address) {
          throw new Error("expected receiver address");
        }
        resolve({
          close: () =>
            new Promise<void>((closeResolve, closeReject) => {
              server.close((error) => {
                if (error) {
                  closeReject(error);
                  return;
                }
                closeResolve();
              });
            }),
          url: `http://127.0.0.1:${address.port}/api/github/webhook`,
        });
      });
    });

    let receiverEmulator: StartedGitHubEmulator | undefined;
    try {
      receiverEmulator = await startGitHubEmulatorOnAvailablePort({
        appOrigin: "https://app.lightfast.localhost",
      });
      const gh = getGitHubStore(receiverEmulator.store);
      const app = gh.apps.findOneBy(
        "app_id",
        GITHUB_EMULATOR_FIXTURES.githubAppId
      );
      if (!app) {
        throw new Error("expected seeded GitHub App");
      }
      gh.apps.update(app.id, { webhook_url: receiver.url });

      const { pushGitHubEmulatorCommit } = await import("../push");
      const push = await pushGitHubEmulatorCommit({
        apiBaseUrl: receiverEmulator.url,
        branch: "main",
        files: [{ content: "# Demo\n", path: "skills/demo/SKILL.md" }],
        message: "Add demo skill",
        owner: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
        repo: GITHUB_EMULATOR_FIXTURES.githubRepoName,
        token: GITHUB_EMULATOR_FIXTURES.userToken,
      });

      await webhookReceived;
      expect(received.length).toBeGreaterThan(0);
      expect(received[0]).toMatchObject({
        event: "push",
        signature: expect.stringMatching(/^sha256=/),
      });
      const delivery = received[0];
      if (!delivery) {
        throw new Error("expected received webhook delivery");
      }
      const expectedSignature = `sha256=${createHmac(
        "sha256",
        GITHUB_EMULATOR_FIXTURES.githubWebhookSecret
      )
        .update(delivery.body)
        .digest("hex")}`;
      expect(delivery.signature).toBe(expectedSignature);
      const payload = JSON.parse(delivery.body) as {
        after?: string;
        before?: string;
        commits?: Array<{
          added?: string[];
          modified?: string[];
          removed?: string[];
        }>;
        installation?: { id?: number };
        ref?: string;
        repository?: { full_name?: string };
      };
      expect(payload).toMatchObject({
        after: push.afterSha,
        before: push.beforeSha,
        installation: { id: GITHUB_EMULATOR_FIXTURES.installationId },
        ref: "refs/heads/main",
        repository: {
          full_name: `${GITHUB_EMULATOR_FIXTURES.githubOrgLogin}/${GITHUB_EMULATOR_FIXTURES.githubRepoName}`,
        },
      });
      expect(payload.commits).toEqual([
        expect.objectContaining({
          added: ["skills/demo/SKILL.md"],
          modified: [],
          removed: [],
        }),
      ]);
    } finally {
      await receiverEmulator?.close();
      await receiver.close();
    }
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
