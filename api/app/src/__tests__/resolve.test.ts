import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

const authMock = vi.fn();
const isOrgBoundMock = vi.fn();
const verifyTokenMock = vi.fn();

vi.mock("@db/app", () => ({
  isOrgBound: (...args: unknown[]) => isOrgBoundMock(...args),
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: (...args: unknown[]) => authMock(...args),
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
  getUserOrgMemberships: vi.fn(),
}));

const { resolveIdentityFromClerk } = await import("../auth/identity");
const db = {} as Database;

beforeEach(() => {
  authMock.mockReset();
  isOrgBoundMock.mockReset();
  verifyTokenMock.mockReset();
});

function resolve(headers = new Headers()) {
  return resolveIdentityFromClerk({ headers, db });
}

describe("resolveIdentityFromClerk — transports", () => {
  it("returns bound active identity when a valid Bearer JWT carries org_id and the DB has an active binding", async () => {
    isOrgBoundMock.mockResolvedValueOnce(true);
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
      orgGate: { bindingStatus: "bound" },
    });
    expect(isOrgBoundMock).toHaveBeenCalledWith(db, "org_active");
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
    expect(isOrgBoundMock).not.toHaveBeenCalled();
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

    const identity = await resolve(
      new Headers({ authorization: "Bearer broken.jwt" })
    );

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).toHaveBeenCalledTimes(1);
    expect(isOrgBoundMock).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when neither Bearer nor cookie produce a session", async () => {
    authMock.mockResolvedValueOnce({ userId: null, orgId: null });

    const identity = await resolve();

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(isOrgBoundMock).not.toHaveBeenCalled();
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
    expect(isOrgBoundMock).not.toHaveBeenCalled();
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
    expect(isOrgBoundMock).not.toHaveBeenCalled();
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated for a malformed Bearer (empty token), without consulting the cookie path", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: "org_cookie",
    });

    const identity = await resolve(new Headers({ authorization: "Bearer " }));

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(isOrgBoundMock).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled();
  });
});

describe("resolveIdentityFromClerk — DB binding gate", () => {
  it("Bearer with org_id and no lf_binding_status claim resolves binding from the DB", async () => {
    isOrgBoundMock.mockResolvedValueOnce(true);
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_bound",
      org_id: "org_bound",
    });

    const identity = await resolve(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_bound",
      orgId: "org_bound",
      orgGate: { bindingStatus: "bound" },
    });
    expect(isOrgBoundMock).toHaveBeenCalledWith(db, "org_bound");
  });

  it("Bearer with org_id and no active DB binding resolves active unbound", async () => {
    isOrgBoundMock.mockResolvedValueOnce(false);
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_unbound",
      org_id: "org_unbound",
    });

    const identity = await resolve(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_unbound",
      orgId: "org_unbound",
      orgGate: { bindingStatus: "unbound" },
    });
    expect(isOrgBoundMock).toHaveBeenCalledWith(db, "org_unbound");
  });

  it("Bearer ignores stale lf_binding_status and resolves binding from the DB", async () => {
    isOrgBoundMock.mockResolvedValueOnce(true);
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_stale",
      org_id: "org_stale",
      lf_binding_status: "definitely-not-a-status",
    });

    const identity = await resolve(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_stale",
      orgId: "org_stale",
      orgGate: { bindingStatus: "bound" },
    });
  });

  it("propagates DB binding lookup failures instead of granting access", async () => {
    isOrgBoundMock.mockRejectedValueOnce(new Error("database unavailable"));
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_db_error",
      org_id: "org_db_error",
    });

    await expect(
      resolve(new Headers({ authorization: "Bearer valid.jwt.token" }))
    ).rejects.toThrow("database unavailable");
  });

  it("Cookie auth with a stale missing claim resolves binding from the DB", async () => {
    isOrgBoundMock.mockResolvedValueOnce(true);
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_bound",
      orgId: "org_cookie_bound",
      sessionClaims: {},
    });

    const identity = await resolve();

    expect(identity).toEqual({
      type: "active",
      userId: "user_cookie_bound",
      orgId: "org_cookie_bound",
      orgGate: { bindingStatus: "bound" },
    });
    expect(isOrgBoundMock).toHaveBeenCalledWith(db, "org_cookie_bound");
  });

  it("Cookie auth with a stale bound claim but no active DB binding resolves active unbound", async () => {
    isOrgBoundMock.mockResolvedValueOnce(false);
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_unknown",
      orgId: "org_cookie_unknown",
      sessionClaims: { lf_binding_status: "bound" },
    });

    const identity = await resolve();

    expect(identity).toEqual({
      type: "active",
      userId: "user_cookie_unknown",
      orgId: "org_cookie_unknown",
      orgGate: { bindingStatus: "unbound" },
    });
  });

  it("Cookie auth with a bound claim but no org_id stays pending (gate ignored)", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_pending",
      orgId: null,
      sessionClaims: { lf_binding_status: "bound" },
    });

    const identity = await resolve();

    expect(identity).toEqual({
      type: "pending",
      userId: "user_cookie_pending",
    });
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });
});
