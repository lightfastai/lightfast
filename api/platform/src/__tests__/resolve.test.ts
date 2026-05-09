import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyServiceJWTMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock("../lib/jwt", () => ({
  verifyServiceJWT: (...args: unknown[]) => verifyServiceJWTMock(...args),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { warn: (...args: unknown[]) => logWarnMock(...args) },
}));

vi.mock("@vendor/observability/error/next", () => ({
  parseError: (err: unknown) => ({
    message: err instanceof Error ? err.message : String(err),
  }),
}));

const { resolveAuth } = await import("../auth/resolve");

beforeEach(() => {
  verifyServiceJWTMock.mockReset();
  logWarnMock.mockReset();
});

describe("resolveAuth", () => {
  it("returns service auth for a valid Bearer JWT", async () => {
    verifyServiceJWTMock.mockResolvedValueOnce({ caller: "app" });

    const auth = await resolveAuth(
      new Headers({ authorization: "Bearer valid.jwt.token" }),
      "test-source"
    );

    expect(auth).toEqual({ type: "service", caller: "app" });
    expect(verifyServiceJWTMock).toHaveBeenCalledWith("valid.jwt.token");
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it("returns undefined when no Authorization header is present", async () => {
    const auth = await resolveAuth(new Headers(), "test-source");

    expect(auth).toBeUndefined();
    expect(verifyServiceJWTMock).not.toHaveBeenCalled();
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it("returns undefined when Authorization uses a non-Bearer scheme", async () => {
    const auth = await resolveAuth(
      new Headers({ authorization: "Basic abc123" }),
      "test-source"
    );

    expect(auth).toBeUndefined();
    expect(verifyServiceJWTMock).not.toHaveBeenCalled();
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated for a malformed Bearer (empty token)", async () => {
    const auth = await resolveAuth(
      new Headers({ authorization: "Bearer " }),
      "test-source"
    );

    expect(auth).toEqual({ type: "unauthenticated" });
    expect(verifyServiceJWTMock).not.toHaveBeenCalled();
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated and logs warn when the JWT is invalid", async () => {
    verifyServiceJWTMock.mockRejectedValueOnce(new Error("jwt expired"));

    const auth = await resolveAuth(
      new Headers({ authorization: "Bearer broken.jwt" }),
      "test-source"
    );

    expect(auth).toEqual({ type: "unauthenticated" });
    expect(verifyServiceJWTMock).toHaveBeenCalledTimes(1);
    expect(logWarnMock).toHaveBeenCalledWith(
      "[trpc] JWT verification error",
      expect.objectContaining({
        source: "test-source",
        error: expect.objectContaining({ message: "jwt expired" }),
      })
    );
  });
});
