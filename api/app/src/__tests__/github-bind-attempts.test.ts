import { beforeEach, describe, expect, it, vi } from "vitest";

const redisSetMock = vi.fn();
const redisGetMock = vi.fn();
const redisGetdelMock = vi.fn();
const nanoidMock = vi.fn();

vi.mock("@vendor/upstash", () => ({
  redis: {
    get: redisGetMock,
    getdel: redisGetdelMock,
    set: redisSetMock,
  },
}));

vi.mock("@vendor/lib", () => ({
  nanoid: nanoidMock,
}));

const {
  consumeGitHubInstallAttempt,
  consumeGitHubOAuthAttempt,
  issueGitHubInstallAttempt,
  issueGitHubOAuthAttempt,
  lookupGitHubInstallAttempt,
  lookupGitHubOAuthAttempt,
} = await import("../github/bind-attempts");

beforeEach(() => {
  redisSetMock.mockReset();
  redisGetMock.mockReset();
  redisGetdelMock.mockReset();
  nanoidMock.mockReset();
  nanoidMock.mockReturnValue("attempt_123456789012345678901234");
});

describe("github bind attempts", () => {
  it("issues and consumes an install attempt with hashed state", async () => {
    const issued = await issueGitHubInstallAttempt({
      clerkOrgId: "org_1",
      emulator: {
        emulatorOrigin: "http://127.0.0.1:4567",
        installationId: "1001",
        providerAccountLogin: "lightfast-emulated",
      },
      lightfastUserId: "user_1",
      orgSlug: "acme",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeGitHubInstallAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_1",
      orgSlug: "acme",
      emulator: { installationId: "1001" },
    });

    expect(redisSetMock).toHaveBeenCalledWith(
      "github-bind-install-attempt:attempt_123456789012345678901234",
      expect.objectContaining({
        stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      { ex: 900 }
    );
  });

  it("looks up an install attempt without deleting it", async () => {
    const issued = await issueGitHubInstallAttempt({
      clerkOrgId: "org_1",
      emulator: {
        emulatorOrigin: "http://127.0.0.1:4567",
        installationId: "1001",
        providerAccountLogin: "lightfast-emulated",
      },
      lightfastUserId: "user_1",
      orgSlug: "acme",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetMock.mockResolvedValueOnce(record);

    await expect(
      lookupGitHubInstallAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_1",
      orgSlug: "acme",
      emulator: { installationId: "1001" },
    });

    expect(redisGetMock).toHaveBeenCalledWith(
      "github-bind-install-attempt:attempt_123456789012345678901234"
    );
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });

  it("rejects tampered OAuth state", async () => {
    const issued = await issueGitHubOAuthAttempt({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      emulator: {
        emulatorOrigin: "http://127.0.0.1:4567",
        installationId: "1001",
        providerAccountLogin: "lightfast-emulated",
      },
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeGitHubOAuthAttempt({
        state: Buffer.from(
          JSON.stringify({
            attemptId: issued.attemptId,
            nonce: "tampered_nonce",
          })
        ).toString("base64url"),
      })
    ).resolves.toBeNull();
  });

  it("looks up an OAuth attempt without deleting it", async () => {
    const issued = await issueGitHubOAuthAttempt({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      emulator: {
        emulatorOrigin: "http://127.0.0.1:4567",
        installationId: "1001",
        providerAccountLogin: "lightfast-emulated",
      },
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetMock.mockResolvedValueOnce(record);

    await expect(
      lookupGitHubOAuthAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      orgSlug: "acme",
      providerInstallationId: "1001",
    });

    expect(redisGetMock).toHaveBeenCalledWith(
      "github-bind-oauth-attempt:attempt_123456789012345678901234"
    );
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });
});
