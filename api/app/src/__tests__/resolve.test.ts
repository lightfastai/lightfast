import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getActiveOrgBindingMock = vi.fn();

vi.mock("@db/app", () => ({
  getActiveOrgBinding: (...args: unknown[]) => getActiveOrgBindingMock(...args),
}));

vi.mock("@vendor/clerk/env", () => ({
  getClerkFrontendApi: () => "https://clerk.example.com",
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: (...args: unknown[]) => authMock(...args),
  clerkClient: () =>
    Promise.resolve({
      users: {
        getOrganizationMembershipList: vi.fn(async () => ({ data: [] })),
      },
    }),
}));

vi.mock("../env", () => ({
  env: {
    CLERK_CLI_OAUTH_CLIENT_ID: "cli_client_test",
    CLERK_DESKTOP_OAUTH_CLIENT_ID: "desktop_client_test",
  },
}));

const { resolveAuthContextFromClerk, resolveIdentityFromClerk } = await import(
  "../auth/identity"
);
const db = {} as Database;

beforeEach(() => {
  authMock.mockReset();
  getActiveOrgBindingMock.mockReset();
});

function resolve(headers = new Headers()) {
  return resolveIdentityFromClerk({ headers, db });
}

function resolveAuth(headers = new Headers()) {
  return resolveAuthContextFromClerk({ headers, db });
}

describe("resolveIdentityFromClerk", () => {
  it("falls through to the cookie path when no authorization header is present", async () => {
    const has = vi.fn(() => true);
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_only",
      orgId: null,
      has,
    });

    const result = await resolveAuth();

    expect(result.identity).toEqual({
      type: "pending",
      userId: "user_cookie_only",
    });
    expect(result.access).toMatchObject({
      kind: "clerk-session",
      userId: "user_cookie_only",
      orgId: null,
    });
  });

  it("resolves cookie active org binding from the DB", async () => {
    getActiveOrgBindingMock.mockResolvedValueOnce({
      metadata: {
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "987",
          installationId: "1001",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountLogin: "acme",
      providerInstallationId: "1001",
    });
    authMock.mockResolvedValueOnce({
      userId: "user_cookie_bound",
      orgId: "org_cookie_bound",
      sessionClaims: {},
    });

    await expect(resolve()).resolves.toEqual({
      type: "active",
      userId: "user_cookie_bound",
      orgId: "org_cookie_bound",
      orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    });
    expect(getActiveOrgBindingMock).toHaveBeenCalledWith(
      db,
      "org_cookie_bound"
    );
  });

  it("rejects bearer requests that do not declare a native client", async () => {
    await expect(
      resolve(new Headers({ authorization: "Bearer legacy-jwt" }))
    ).resolves.toEqual({ type: "unauthenticated" });
    expect(authMock).not.toHaveBeenCalled();
  });
});
