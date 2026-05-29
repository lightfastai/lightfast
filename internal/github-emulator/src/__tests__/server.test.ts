import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  formatGitHubEmulatorEnvString,
  GITHUB_EMULATOR_FIXTURES,
  getGitHubEmulatorEnv,
} from "../fixtures";
import {
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
        GITHUB_INSTALL_URL_OVERRIDE:
          "https://lightfast.localhost/api/dev/github/install?emulator_origin=https%3A%2F%2Fgithub.lightfast.localhost&installation_id=1001",
      })
    ).toBe(
      [
        "GITHUB_APP_ID='424242'",
        "GITHUB_APP_PRIVATE_KEY='line1 line2\\nline3'",
        "GITHUB_INSTALL_URL_OVERRIDE='https://lightfast.localhost/api/dev/github/install?emulator_origin=https%3A%2F%2Fgithub.lightfast.localhost&installation_id=1001'",
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
