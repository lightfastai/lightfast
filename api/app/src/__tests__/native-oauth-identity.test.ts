import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const isOrgBoundMock = vi.fn();
const clerkGetOrganizationMembershipListMock = vi.fn();

vi.mock("@db/app", () => ({
  isOrgBound: isOrgBoundMock,
}));

vi.mock("@vendor/clerk/env", () => ({
  getClerkFrontendApi: () => "https://clerk.example.com",
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      users: {
        getOrganizationMembershipList: clerkGetOrganizationMembershipListMock,
      },
    }),
}));

vi.mock("../env", () => ({
  env: {
    CLERK_CLI_OAUTH_CLIENT_ID: "cli_client_test",
    CLERK_DESKTOP_OAUTH_CLIENT_ID: "desktop_client_test",
  },
}));

const { resolveAuthContextFromClerk } = await import("../auth/identity");

describe("native OAuth identity resolution", () => {
  beforeEach(() => {
    authMock.mockReset();
    isOrgBoundMock.mockReset();
    clerkGetOrganizationMembershipListMock.mockReset();
    isOrgBoundMock.mockResolvedValue(true);
    clerkGetOrganizationMembershipListMock.mockResolvedValue({
      data: [{ organization: { id: "org_1", name: "Acme", slug: "acme" } }],
    });
  });

  it("resolves native OAuth without org header as pending for finalization", async () => {
    authMock.mockResolvedValueOnce({
      clientId: "desktop_client_test",
      isAuthenticated: true,
      scopes: ["openid", "profile", "email"],
      tokenType: "oauth_token",
      userId: "user_1",
    });

    await expect(
      resolveAuthContextFromClerk({
        db: {} as Database,
        headers: new Headers({
          authorization: "Bearer access",
          "x-lightfast-native-client": "desktop",
        }),
      })
    ).resolves.toEqual({
      access: {
        client: "desktop",
        clientId: "desktop_client_test",
        kind: "clerk-oauth",
        scopes: ["openid", "profile", "email"],
        userId: "user_1",
      },
      identity: { type: "pending", userId: "user_1" },
    });
  });

  it("resolves native OAuth with a valid org header as active", async () => {
    authMock.mockResolvedValueOnce({
      clientId: "desktop_client_test",
      isAuthenticated: true,
      scopes: ["openid", "profile", "email"],
      tokenType: "oauth_token",
      userId: "user_1",
    });

    await expect(
      resolveAuthContextFromClerk({
        db: {} as Database,
        headers: new Headers({
          authorization: "Bearer access",
          "x-lightfast-native-client": "desktop",
          "x-lightfast-organization-id": "org_1",
        }),
      })
    ).resolves.toMatchObject({
      access: { client: "desktop", kind: "clerk-oauth", userId: "user_1" },
      identity: {
        orgGate: { bindingStatus: "bound" },
        orgId: "org_1",
        type: "active",
        userId: "user_1",
      },
    });
  });

  it("rejects native OAuth org headers for organizations the user does not belong to", async () => {
    authMock.mockResolvedValueOnce({
      clientId: "desktop_client_test",
      isAuthenticated: true,
      scopes: ["openid", "profile", "email"],
      tokenType: "oauth_token",
      userId: "user_1",
    });

    await expect(
      resolveAuthContextFromClerk({
        db: {} as Database,
        headers: new Headers({
          authorization: "Bearer access",
          "x-lightfast-native-client": "desktop",
          "x-lightfast-organization-id": "org_missing",
        }),
      })
    ).resolves.toEqual({ identity: { type: "unauthenticated" } });
  });
});
