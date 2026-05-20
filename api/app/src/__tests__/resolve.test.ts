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

const { resolveIdentityFromClerk } = await import("../auth/identity");

beforeEach(() => {
  authMock.mockReset();
  verifyTokenMock.mockReset();
});

describe("resolveIdentityFromClerk — transports", () => {
  it("returns active identity when a valid Bearer JWT carries org_id", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_active",
      org_id: "org_active",
    });

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_active",
      orgId: "org_active",
      // No `lf_binding_status` claim was minted → fail-closed `unbound`.
      orgGate: { bindingStatus: "unbound" },
    });
    expect(verifyTokenMock).toHaveBeenCalledWith("valid.jwt.token", {
      secretKey: "sk_test_fake-secret-key-for-tests",
    });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns pending identity when a valid Bearer JWT lacks org_id", async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: "user_bearer_pending" });

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "pending",
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

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Bearer broken.jwt" })
    );

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).toHaveBeenCalledTimes(1);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when neither Bearer nor cookie produce a session", async () => {
    authMock.mockResolvedValueOnce({ userId: null, orgId: null });

    const identity = await resolveIdentityFromClerk(new Headers());

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
  });

  it("falls through to the cookie path when no authorization header is present", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_only",
      orgId: null,
    });

    const identity = await resolveIdentityFromClerk(new Headers());

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

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Basic abc123" })
    );

    expect(identity).toEqual({ type: "pending", userId: "user_cookie" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated for a malformed Bearer (empty token), without consulting the cookie path", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: "org_cookie",
    });

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Bearer " })
    );

    expect(identity).toEqual({ type: "unauthenticated" });
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled();
  });
});

describe("resolveIdentityFromClerk — binding-status gate", () => {
  it("Bearer with org_id and lf_binding_status 'bound' → active bound", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_bound",
      org_id: "org_bound",
      lf_binding_status: "bound",
    });

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_bound",
      orgId: "org_bound",
      orgGate: { bindingStatus: "bound" },
    });
  });

  it("Bearer with org_id and lf_binding_status 'revoked' → active revoked", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_revoked",
      org_id: "org_revoked",
      lf_binding_status: "revoked",
    });

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_revoked",
      orgId: "org_revoked",
      orgGate: { bindingStatus: "revoked" },
    });
  });

  it("Bearer with org_id but missing lf_binding_status → active unbound (fail closed)", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_missing",
      org_id: "org_missing",
    });

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_missing",
      orgId: "org_missing",
      orgGate: { bindingStatus: "unbound" },
    });
  });

  it("Bearer with org_id and an unknown lf_binding_status value → active unbound", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_unknown",
      org_id: "org_unknown",
      lf_binding_status: "definitely-not-a-status",
    });

    const identity = await resolveIdentityFromClerk(
      new Headers({ authorization: "Bearer valid.jwt.token" })
    );

    expect(identity).toEqual({
      type: "active",
      userId: "user_bearer_unknown",
      orgId: "org_unknown",
      orgGate: { bindingStatus: "unbound" },
    });
  });

  it("Cookie auth with a bound claim → active bound", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_bound",
      orgId: "org_cookie_bound",
      sessionClaims: { lf_binding_status: "bound" },
    });

    const identity = await resolveIdentityFromClerk(new Headers());

    expect(identity).toEqual({
      type: "active",
      userId: "user_cookie_bound",
      orgId: "org_cookie_bound",
      orgGate: { bindingStatus: "bound" },
    });
  });

  it("Cookie auth with an unknown claim → active unbound (fail closed)", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_unknown",
      orgId: "org_cookie_unknown",
      sessionClaims: { lf_binding_status: "??? stale ???" },
    });

    const identity = await resolveIdentityFromClerk(new Headers());

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

    const identity = await resolveIdentityFromClerk(new Headers());

    expect(identity).toEqual({
      type: "pending",
      userId: "user_cookie_pending",
    });
  });
});
