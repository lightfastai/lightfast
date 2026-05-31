import { beforeEach, describe, expect, it, vi } from "vitest";

const redisSetMock = vi.fn();
const redisGetMock = vi.fn();
const redisGetdelMock = vi.fn();
const nanoidMock = vi.fn();

vi.mock("@vendor/upstash", () => ({
  redis: { get: redisGetMock, getdel: redisGetdelMock, set: redisSetMock },
}));

vi.mock("@vendor/lib", () => ({
  nanoid: nanoidMock,
}));

const {
  consumeGitHubUserAccountOAuthAttempt,
  issueGitHubUserAccountOAuthAttempt,
  lookupGitHubUserAccountOAuthAttempt,
} = await import("../services/github/user-account/attempts");

beforeEach(() => {
  redisSetMock.mockReset();
  redisGetMock.mockReset();
  redisGetdelMock.mockReset();
  nanoidMock.mockReset();
  nanoidMock.mockReturnValue("attempt_123456789012345678901234");
});

describe("github user account OAuth attempts", () => {
  it("issues and consumes hashed-state user account OAuth attempts", async () => {
    const issued = await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      returnTo: "/account/tasks/github",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    expect(record).toEqual({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
      returnTo: "/account/tasks/github",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeGitHubUserAccountOAuthAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });

    expect(redisSetMock).toHaveBeenCalledWith(
      "github-user-account-oauth-attempt:attempt_123456789012345678901234",
      record,
      { ex: 900 }
    );
  });

  it("looks up attempts without deleting them", async () => {
    const issued = await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetMock.mockResolvedValueOnce(record);

    await expect(
      lookupGitHubUserAccountOAuthAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });

  it("rejects invalid Redis records during lookup even when state hash matches", async () => {
    const issued = await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetMock.mockResolvedValueOnce({ ...record, codeVerifier: "" });

    await expect(
      lookupGitHubUserAccountOAuthAttempt({ state: issued.state })
    ).resolves.toBeNull();
  });

  it("rejects Redis records with unsafe returnTo values", async () => {
    const issued = await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetMock.mockResolvedValueOnce({
      ...record,
      returnTo: "/account\\settings",
    });

    await expect(
      lookupGitHubUserAccountOAuthAttempt({ state: issued.state })
    ).resolves.toBeNull();
  });

  it("rejects invalid pending Redis records during consume without deleting", async () => {
    const issued = await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetMock.mockResolvedValueOnce({ ...record, lightfastUserId: "" });

    await expect(
      consumeGitHubUserAccountOAuthAttempt({ state: issued.state })
    ).resolves.toBeNull();
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });

  it("returns null when deletion races after a valid pending record", async () => {
    const issued = await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(null);

    await expect(
      consumeGitHubUserAccountOAuthAttempt({ state: issued.state })
    ).resolves.toBeNull();
  });

  it("does not store returnTo when it is not provided", async () => {
    await issueGitHubUserAccountOAuthAttempt({
      codeVerifier: "verifier",
      lightfastUserId: "user_1",
    });
    const record = redisSetMock.mock.calls[0]?.[1];

    expect(record).not.toHaveProperty("returnTo");
  });

  it("returns null for malformed states", async () => {
    await expect(
      lookupGitHubUserAccountOAuthAttempt({ state: "not-base64-json" })
    ).resolves.toBeNull();
    await expect(
      consumeGitHubUserAccountOAuthAttempt({ state: "not-base64-json" })
    ).resolves.toBeNull();
    expect(redisGetMock).not.toHaveBeenCalled();
    expect(redisGetdelMock).not.toHaveBeenCalled();
  });
});
