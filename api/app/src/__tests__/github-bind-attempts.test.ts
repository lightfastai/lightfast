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
} = await import("../services/github/setup/attempts");

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
      lightfastUserId: "user_1",
      orgSlug: "acme",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    expect(record).toEqual({
      clerkOrgId: "org_1",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(record).not.toHaveProperty("emulator");

    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeGitHubInstallAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_1",
      orgSlug: "acme",
    });

    expect(redisSetMock).toHaveBeenCalledWith(
      "github-bind-install-attempt:attempt_123456789012345678901234",
      record,
      { ex: 900 }
    );
  });

  it("looks up an install attempt without deleting it", async () => {
    const issued = await issueGitHubInstallAttempt({
      clerkOrgId: "org_1",
      lightfastUserId: "user_1",
      orgSlug: "acme",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    expect(record).toEqual({
      clerkOrgId: "org_1",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(record).not.toHaveProperty("emulator");

    redisGetMock.mockResolvedValueOnce(record);

    await expect(
      lookupGitHubInstallAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_1",
      orgSlug: "acme",
    });

    expect(redisGetMock).toHaveBeenCalledWith(
      "github-bind-install-attempt:attempt_123456789012345678901234"
    );
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });

  it("rejects tampered OAuth state without deleting the stored attempt", async () => {
    const issued = await issueGitHubOAuthAttempt({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    expect(record).toEqual({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(record).not.toHaveProperty("emulator");

    redisGetMock.mockResolvedValueOnce(record);

    await expect(
      consumeGitHubOAuthAttempt({
        state: Buffer.from(
          JSON.stringify({
            attemptId: issued.attemptId,
            nonce: "tampered_nonce_1234567890",
          })
        ).toString("base64url"),
      })
    ).resolves.toBeNull();

    expect(redisGetMock).toHaveBeenCalledWith(
      "github-bind-oauth-attempt:attempt_123456789012345678901234"
    );
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });

  it("returns null when a matching attempt is already consumed by another callback", async () => {
    const issued = await issueGitHubOAuthAttempt({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    expect(record).toEqual({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(record).not.toHaveProperty("emulator");

    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(null);

    await expect(
      consumeGitHubOAuthAttempt({ state: issued.state })
    ).resolves.toBeNull();
  });

  it("looks up an OAuth attempt without deleting it", async () => {
    const issued = await issueGitHubOAuthAttempt({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    expect(record).toEqual({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(record).not.toHaveProperty("emulator");

    redisGetMock.mockResolvedValueOnce(record);

    await expect(
      lookupGitHubOAuthAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      orgSlug: "acme",
      providerInstallationId: "1001",
      setupAction: "install",
    });

    expect(redisGetMock).toHaveBeenCalledWith(
      "github-bind-oauth-attempt:attempt_123456789012345678901234"
    );
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });
});
