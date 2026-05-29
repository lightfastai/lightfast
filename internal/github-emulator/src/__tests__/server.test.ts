import { createPrivateKey } from "node:crypto";
import { createServer as createNodeServer } from "node:net";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  formatGitHubEmulatorEnvShell,
  GITHUB_EMULATOR_FIXTURES,
  getGitHubEmulatorEnv,
} from "../fixtures";
import { type StartedGitHubEmulator, startGitHubEmulator } from "../server";

let emulator: StartedGitHubEmulator | undefined;
let emulatorPort: number;

async function getAvailablePort() {
  const server = createNodeServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate an available local port");
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  return address.port;
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

beforeAll(async () => {
  emulatorPort = await getAvailablePort();
  emulator = await startGitHubEmulator({ port: emulatorPort });
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

  it("prints the env values consumed by app and api packages", () => {
    expect(getGitHubEmulatorEnv("https://lightfast.localhost")).toEqual(
      expect.objectContaining({
        GITHUB_APP_ID: String(GITHUB_EMULATOR_FIXTURES.githubAppId),
        GITHUB_APP_SLUG: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
        GITHUB_INSTALL_URL_OVERRIDE:
          "https://lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated",
      })
    );
  });

  it("prints install overrides for a custom emulator origin", () => {
    expect(
      getGitHubEmulatorEnv(
        "https://lightfast.localhost",
        "http://127.0.0.1:4568"
      )
    ).toEqual(
      expect.objectContaining({
        GITHUB_INSTALL_URL_OVERRIDE:
          "https://lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4568&installation_id=1001&provider_account_login=lightfast-emulated",
      })
    );
  });

  it("starts with a distinct Portless public origin", async () => {
    const portlessPort = await getAvailablePort();
    const portlessEmulator = await startGitHubEmulator({
      appOrigin: "https://feature.lightfast.localhost",
      port: portlessPort,
      publicOrigin: "https://feature.github.lightfast.localhost",
    });

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

  it("formats shell-safe env exports for runtime injection", () => {
    expect(
      formatGitHubEmulatorEnvShell({
        GITHUB_APP_ID: "424242",
        GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
        GITHUB_INSTALL_URL_OVERRIDE:
          "https://lightfast.localhost/api/dev/github/install?emulator_origin=https%3A%2F%2Fgithub.lightfast.localhost&installation_id=1001",
      })
    ).toBe(
      [
        "export GITHUB_APP_ID='424242'",
        "export GITHUB_APP_PRIVATE_KEY='line1\\nline2'",
        "export GITHUB_INSTALL_URL_OVERRIDE='https://lightfast.localhost/api/dev/github/install?emulator_origin=https%3A%2F%2Fgithub.lightfast.localhost&installation_id=1001'",
      ].join("\n")
    );
  });

  it("rejects when the requested port is already in use", async () => {
    await expect(
      startGitHubEmulator({ port: emulatorPort })
    ).rejects.toMatchObject({
      code: "EADDRINUSE",
    });
  });
});
