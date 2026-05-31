import { Store } from "@emulators/core";
import { githubPlugin, seedFromConfig } from "@emulators/github";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createGitHubEmulatorSeed,
  GITHUB_EMULATOR_FIXTURES,
} from "../fixtures";
import { createGitHubCompatibleFetch } from "../github-compatible-routes";
import { addOrgMembership, type StartedGitHubEmulator } from "../server";
import {
  authorizeOAuthCode,
  createCodeChallenge,
  exchangeOAuthCode,
  startGitHubEmulatorOnAvailablePort,
  userAccountCallbackUrl,
} from "./test-helpers";

let emulator: StartedGitHubEmulator | undefined;

beforeAll(async () => {
  emulator = await startGitHubEmulatorOnAvailablePort();
});

afterAll(async () => {
  await emulator?.close();
});

describe("GitHub emulator user account OAuth", () => {
  it("performs user account OAuth with refreshable token fields", async () => {
    const codeVerifier = "verifier_123456789012345678901234567890";
    const code = await authorizeOAuthCode(emulator?.url ?? "", codeVerifier, {
      redirectUri: userAccountCallbackUrl(),
      state: "user_account_state_123",
    });
    const tokenRes = await exchangeOAuthCode(
      emulator?.url ?? "",
      code,
      codeVerifier,
      {
        redirectUri: userAccountCallbackUrl(),
      }
    );

    expect(tokenRes.status).toBe(200);
    await expect(tokenRes.json()).resolves.toMatchObject({
      access_token: expect.stringMatching(/^ghu_/),
      expires_in: 28_800,
      refresh_token: expect.stringMatching(/^ghr_/),
      refresh_token_expires_in: 15_768_000,
      token_type: "bearer",
    });
  });

  it("refreshes user account OAuth tokens", async () => {
    const codeVerifier = "verifier_123456789012345678901234567890";
    const code = await authorizeOAuthCode(emulator?.url ?? "", codeVerifier, {
      redirectUri: userAccountCallbackUrl(),
      state: "user_account_state_123",
    });
    const tokenRes = await exchangeOAuthCode(
      emulator?.url ?? "",
      code,
      codeVerifier,
      {
        redirectUri: userAccountCallbackUrl(),
      }
    );
    expect(tokenRes.status).toBe(200);
    const tokenBody = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    expect(tokenBody).toMatchObject({
      access_token: expect.stringMatching(/^ghu_/),
      refresh_token: expect.stringMatching(/^ghr_/),
    });

    const refreshRes = await fetch(
      `${emulator?.url}/login/oauth/access_token`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
          client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
          grant_type: "refresh_token",
          refresh_token: tokenBody.refresh_token,
        }),
      }
    );

    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    expect(refreshBody).toMatchObject({
      access_token: expect.stringMatching(/^ghu_/),
      expires_in: 28_800,
      refresh_token: expect.stringMatching(/^ghr_/),
      refresh_token_expires_in: 15_768_000,
      token_type: "bearer",
    });
    expect(refreshBody.access_token).not.toBe(tokenBody.access_token);
    expect(refreshBody.refresh_token).not.toBe(tokenBody.refresh_token);

    const userRes = await fetch(`${emulator?.url}/user`, {
      headers: {
        authorization: `Bearer ${refreshBody.access_token}`,
      },
    });
    expect(userRes.status).toBe(200);
    await expect(userRes.json()).resolves.toMatchObject({
      login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
      type: "User",
    });
  });

  it("revokes user account OAuth grants", async () => {
    const codeVerifier = "verifier_123456789012345678901234567890";
    const code = await authorizeOAuthCode(emulator?.url ?? "", codeVerifier, {
      redirectUri: userAccountCallbackUrl(),
      state: "user_account_state_123",
    });
    const tokenRes = await exchangeOAuthCode(
      emulator?.url ?? "",
      code,
      codeVerifier,
      {
        redirectUri: userAccountCallbackUrl(),
      }
    );
    expect(tokenRes.status).toBe(200);
    const tokenBody = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    const revokeRes = await fetch(
      `${emulator?.url}/applications/${GITHUB_EMULATOR_FIXTURES.oauthClientId}/grant`,
      {
        method: "DELETE",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Basic ${Buffer.from(
            `${GITHUB_EMULATOR_FIXTURES.oauthClientId}:${GITHUB_EMULATOR_FIXTURES.oauthClientSecret}`
          ).toString("base64")}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ access_token: tokenBody.access_token }),
      }
    );
    expect(revokeRes.status).toBe(204);

    const userRes = await fetch(`${emulator?.url}/user`, {
      headers: {
        authorization: `Bearer ${tokenBody.access_token}`,
      },
    });
    expect(userRes.status).toBe(401);

    const refreshRes = await fetch(
      `${emulator?.url}/login/oauth/access_token`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
          client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
          grant_type: "refresh_token",
          refresh_token: tokenBody.refresh_token,
        }),
      }
    );
    expect(refreshRes.status).toBe(200);
    await expect(refreshRes.json()).resolves.toMatchObject({
      error: "bad_refresh_token",
    });
  });

  it("refreshes user account OAuth tokens after the access token expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-30T00:00:00.000Z"));

    try {
      const store = new Store();
      githubPlugin.seed?.(store, GITHUB_EMULATOR_FIXTURES.origin);
      seedFromConfig(
        store,
        GITHUB_EMULATOR_FIXTURES.origin,
        createGitHubEmulatorSeed()
      );
      addOrgMembership(store);
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
      authorizeUrl.searchParams.set("redirect_uri", userAccountCallbackUrl());
      authorizeUrl.searchParams.set("state", "user_account_state_123");
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
              redirect_uri: userAccountCallbackUrl(),
            }),
          }
        )
      );
      expect(tokenRes.status).toBe(200);
      const tokenBody = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      expect(tokenBody).toMatchObject({
        access_token: expect.stringMatching(/^ghu_/),
        refresh_token: expect.stringMatching(/^ghr_/),
      });

      vi.advanceTimersByTime(28_800 * 1000 + 1);

      const userRes = await fetchCompatible(
        new Request(`${GITHUB_EMULATOR_FIXTURES.origin}/user`, {
          headers: {
            authorization: `Bearer ${tokenBody.access_token}`,
          },
        })
      );
      expect(userRes.status).toBe(401);

      const refreshRes = await fetchCompatible(
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
              grant_type: "refresh_token",
              refresh_token: tokenBody.refresh_token,
            }),
          }
        )
      );
      expect(refreshRes.status).toBe(200);
      await expect(refreshRes.json()).resolves.toMatchObject({
        access_token: expect.stringMatching(/^ghu_/),
        expires_in: 28_800,
        refresh_token: expect.stringMatching(/^ghr_/),
        refresh_token_expires_in: 15_768_000,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects expired user account OAuth tokens on fallback routes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-30T00:00:00.000Z"));

    try {
      const codeVerifier = "verifier_123456789012345678901234567890";
      const code = await authorizeOAuthCode(emulator?.url ?? "", codeVerifier, {
        redirectUri: userAccountCallbackUrl(),
        state: "user_account_state_123",
      });
      const tokenRes = await exchangeOAuthCode(
        emulator?.url ?? "",
        code,
        codeVerifier,
        {
          redirectUri: userAccountCallbackUrl(),
        }
      );
      expect(tokenRes.status).toBe(200);
      const tokenBody = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      expect(tokenBody).toMatchObject({
        access_token: expect.stringMatching(/^ghu_/),
        refresh_token: expect.stringMatching(/^ghr_/),
      });

      vi.setSystemTime(new Date("2026-05-30T08:00:01.000Z"));

      const userRes = await fetch(`${emulator?.url}/user`, {
        headers: {
          authorization: `Bearer ${tokenBody.access_token}`,
        },
      });
      expect(userRes.status).toBe(401);

      const orgsRes = await fetch(`${emulator?.url}/user/orgs`, {
        headers: {
          authorization: `Bearer ${tokenBody.access_token}`,
        },
      });
      expect(orgsRes.status).toBe(401);
      await expect(orgsRes.json()).resolves.toEqual({
        message: "Bad credentials",
      });

      const refreshRes = await fetch(
        `${emulator?.url}/login/oauth/access_token`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
            client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
            grant_type: "refresh_token",
            refresh_token: tokenBody.refresh_token,
          }),
        }
      );
      expect(refreshRes.status).toBe(200);
      await expect(refreshRes.json()).resolves.toMatchObject({
        access_token: expect.stringMatching(/^ghu_/),
        refresh_token: expect.stringMatching(/^ghr_/),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
