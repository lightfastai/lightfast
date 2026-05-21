import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@db/app", () => ({}));

const authMock = vi.fn();
const verifyTokenMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  auth: (...args: unknown[]) => authMock(...args),
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
  getUserOrgMemberships: vi.fn(),
}));

const { resolveIdentityFromClerk } = await import("../auth/identity");
const db = {} as Parameters<typeof resolveIdentityFromClerk>[0]["db"];

beforeEach(() => {
  authMock.mockReset();
  verifyTokenMock.mockReset();
});

function resolve(headers = new Headers()) {
  return resolveIdentityFromClerk({ headers, db });
}

describe("resolveIdentityFromClerk — transports", () => {
  it("returns active identity when a valid Bearer JWT carries org_id", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_active",
      org_id: "org_active",
    });

    const identity = await resolve(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_active",
      orgId: "org_active",
    });
    expect(verifyTokenMock).toHaveBeenCalledWith("valid.jwt.token", {
      secretKey: "sk_test_fake-secret-key-for-tests",
    });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns pending identity when a valid Bearer JWT lacks org_id", async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: "user_bearer_pending" });

    const identity = await resolve(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "pending",
      userId: "user_bearer_pending",
    });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when the Bearer JWT is invalid, without consulting the cookie path", async () => {
    verifyTokenMock.mockRejectedValueOnce(new Error("jwt expired"));
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: "org_cookie",
    });

    const identity = await resolve(
      new Headers({ authorization: "Bearer broken.jwt" })
    );

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).toHaveBeenCalledTimes(1);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when neither Bearer nor cookie produce a session", async () => {
    authMock.mockResolvedValueOnce({ userId: null, orgId: null });

    const identity = await resolve();

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
  });

  it("falls through to the cookie path when no authorization header is present", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_only",
      orgId: null,
    });

    const identity = await resolve();

    expect(identity).toEqual({
      type: "pending",
      userId: "user_cookie_only",
    });
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it("falls through to cookie when Authorization uses a non-Bearer scheme", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: null,
    });

    const identity = await resolve(
      new Headers({ authorization: "Basic abc123" })
    );

    expect(identity).toEqual({ type: "pending", userId: "user_cookie" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated for a malformed Bearer without consulting the cookie path", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: "org_cookie",
    });

    const identity = await resolve(new Headers({ authorization: "Bearer " }));

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled();
  });
});

describe("resolveIdentityFromClerk — source binding removed", () => {
  it("ignores stale lf_binding_status claims on Bearer JWTs", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_stale",
      org_id: "org_stale",
      lf_binding_status: "unbound",
    });

    await expect(
      resolve(new Headers({ authorization: "Bearer valid.jwt.token" }))
    ).resolves.toEqual({
      type: "active",
      userId: "user_bearer_stale",
      orgId: "org_stale",
    });
  });

  it("ignores stale lf_binding_status claims on cookie sessions", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_active",
      orgId: "org_cookie_active",
      sessionClaims: { lf_binding_status: "unbound" },
    });

    await expect(resolve()).resolves.toEqual({
      type: "active",
      userId: "user_cookie_active",
      orgId: "org_cookie_active",
    });
  });
});
