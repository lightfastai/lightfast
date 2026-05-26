import { beforeEach, describe, expect, it, vi } from "vitest";

const redisSetMock = vi.fn();
const redisGetdelMock = vi.fn();
const nanoidMock = vi.fn();

vi.mock("@vendor/upstash", () => ({
  redis: {
    getdel: redisGetdelMock,
    set: redisSetMock,
  },
}));

vi.mock("@vendor/lib", () => ({
  nanoid: nanoidMock,
}));

const { consumeNativeAuthAttempt, issueNativeAuthAttempt } = await import(
  "../auth/native-auth-attempts"
);

describe("native auth attempts", () => {
  beforeEach(() => {
    redisSetMock.mockReset();
    redisGetdelMock.mockReset();
    nanoidMock.mockReset();
    nanoidMock.mockReturnValue("attempt_123456789012345678901234");
  });

  it("issues Redis-backed attempts with a hashed state envelope", async () => {
    const issued = await issueNativeAuthAttempt({
      client: "cli",
      codeChallenge: "a".repeat(43),
      codeChallengeMethod: "S256",
      organizationId: "org_1",
      redirectUri: "http://127.0.0.1:51010/callback",
      stateNonce: "nonce_1234567890",
      userId: "user_1",
    });

    expect(issued.attemptId).toBe("attempt_123456789012345678901234");
    expect(
      JSON.parse(Buffer.from(issued.state, "base64url").toString("utf8"))
    ).toEqual({
      attemptId: "attempt_123456789012345678901234",
      nonce: "nonce_1234567890",
    });
    expect(redisSetMock).toHaveBeenCalledWith(
      "native-auth-attempt:attempt_123456789012345678901234",
      expect.objectContaining({
        client: "cli",
        organizationId: "org_1",
        stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        userId: "user_1",
      }),
      { ex: 600 }
    );
  });

  it("consumes an attempt only when the returned state hash matches", async () => {
    const issued = await issueNativeAuthAttempt({
      client: "desktop",
      codeChallenge: "b".repeat(43),
      codeChallengeMethod: "S256",
      organizationId: "org_2",
      redirectUri: "http://127.0.0.1:51011/callback",
      stateNonce: "nonce_1234567890",
      userId: "user_2",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeNativeAuthAttempt({
        attemptId: issued.attemptId,
        state: issued.state,
      })
    ).resolves.toMatchObject({
      client: "desktop",
      organizationId: "org_2",
      userId: "user_2",
    });

    redisGetdelMock.mockResolvedValueOnce(record);
    await expect(
      consumeNativeAuthAttempt({
        attemptId: issued.attemptId,
        state: Buffer.from(
          JSON.stringify({
            attemptId: issued.attemptId,
            nonce: "tampered_nonce",
          })
        ).toString("base64url"),
      })
    ).resolves.toBeNull();
  });
});
