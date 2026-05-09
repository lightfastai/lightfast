import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

const authMock = vi.fn();
const verifyTokenMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  auth: (...args: unknown[]) => authMock(...args),
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
  getUserOrgMemberships: vi.fn(),
}));

const { resolveAuth } = await import("../auth/resolve");

beforeEach(() => {
  authMock.mockReset();
  verifyTokenMock.mockReset();
});

describe("resolveAuth", () => {
  it("returns clerk-active when a valid Bearer JWT carries org_id", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_active",
      org_id: "org_active",
    });

    const auth = await resolveAuth(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(auth).toEqual({
      type: "clerk-active",
      userId: "user_bearer_active",
      orgId: "org_active",
    });
    expect(verifyTokenMock).toHaveBeenCalledWith("valid.jwt.token", {
      secretKey: "sk_test_fake-secret-key-for-tests",
    });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns clerk-pending when a valid Bearer JWT lacks org_id", async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: "user_bearer_pending" });

    const auth = await resolveAuth(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(auth).toEqual({
      type: "clerk-pending",
      userId: "user_bearer_pending",
    });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when the Bearer JWT is invalid, without consulting the cookie path", async () => {
    // Even when a valid cookie session is staged, an offered-but-rejected Bearer
    // is the sole source of truth: the only Bearer caller (desktop renderer) is
    // cross-origin and never sends cookies, so cookies cannot rescue a bad token.
    verifyTokenMock.mockRejectedValueOnce(new Error("jwt expired"));
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: "org_cookie",
    });

    const auth = await resolveAuth(
      new Headers({ authorization: "Bearer broken.jwt" })
    );

    expect(auth).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).toHaveBeenCalledTimes(1);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when neither Bearer nor cookie produce a session", async () => {
    authMock.mockResolvedValueOnce({ userId: null, orgId: null });

    const auth = await resolveAuth(new Headers());

    expect(auth).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
  });

  it("falls through to the cookie path when no authorization header is present", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_only",
      orgId: null,
    });

    const auth = await resolveAuth(new Headers());

    expect(auth).toEqual({
      type: "clerk-pending",
      userId: "user_cookie_only",
    });
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it("falls through to cookie when Authorization uses a non-Bearer scheme", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: null,
    });

    const auth = await resolveAuth(
      new Headers({ authorization: "Basic abc123" })
    );

    expect(auth).toEqual({ type: "clerk-pending", userId: "user_cookie" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated for a malformed Bearer (empty token), without consulting the cookie path", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: "org_cookie",
    });

    const auth = await resolveAuth(new Headers({ authorization: "Bearer " }));

    expect(auth).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled();
  });
});
