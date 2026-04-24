import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@db/app/client", () => ({
  db: {},
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

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

const { resolveClerkSession } = await import("../trpc");

beforeEach(() => {
  authMock.mockReset();
  verifyTokenMock.mockReset();
});

describe("resolveClerkSession", () => {
  it("returns userId + orgId when a valid Bearer JWT carries org_id", async () => {
    verifyTokenMock.mockResolvedValueOnce({
      sub: "user_bearer_active",
      org_id: "org_active",
    });

    const headers = new Headers({
      authorization: "Bearer valid.jwt.token",
    });

    const session = await resolveClerkSession(headers);

    expect(session).toEqual({
      userId: "user_bearer_active",
      orgId: "org_active",
    });
    expect(verifyTokenMock).toHaveBeenCalledWith("valid.jwt.token", {
      secretKey: "sk_test_fake-secret-key-for-tests",
    });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("returns userId with null orgId when a valid Bearer JWT lacks org_id", async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: "user_bearer_pending" });

    const headers = new Headers({
      authorization: "Bearer valid.jwt.token",
    });

    const session = await resolveClerkSession(headers);

    expect(session).toEqual({
      userId: "user_bearer_pending",
      orgId: null,
    });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("falls through to the cookie path when the Bearer JWT is invalid", async () => {
    verifyTokenMock.mockRejectedValueOnce(new Error("jwt expired"));
    authMock.mockResolvedValueOnce({
      userId: "user_cookie",
      orgId: "org_cookie",
    });

    const headers = new Headers({ authorization: "Bearer broken.jwt" });

    const session = await resolveClerkSession(headers);

    expect(session).toEqual({
      userId: "user_cookie",
      orgId: "org_cookie",
    });
    expect(verifyTokenMock).toHaveBeenCalledTimes(1);
    expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
  });

  it("returns null when the Bearer JWT is invalid and no cookie session exists", async () => {
    verifyTokenMock.mockRejectedValueOnce(new Error("jwt expired"));
    authMock.mockResolvedValueOnce({ userId: null, orgId: null });

    const session = await resolveClerkSession(
      new Headers({ authorization: "Bearer expired.jwt" })
    );

    expect(session).toBeNull();
    expect(verifyTokenMock).toHaveBeenCalledTimes(1);
    expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
  });

  it("returns null when neither Bearer nor cookie produce a session", async () => {
    authMock.mockResolvedValueOnce({ userId: null, orgId: null });

    const session = await resolveClerkSession(new Headers());

    expect(session).toBeNull();
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
  });

  it("uses the cookie path when no authorization header is present", async () => {
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_only",
      orgId: null,
    });

    const session = await resolveClerkSession(new Headers());

    expect(session).toEqual({
      userId: "user_cookie_only",
      orgId: null,
    });
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });
});
