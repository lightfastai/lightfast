import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getActiveOrgBindingMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const clerkGetOrganizationMembershipListMock = vi.fn();

vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
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
    getActiveOrgBindingMock.mockReset();
    getCurrentOrgConnectorConnectionMock.mockReset();
    clerkGetOrganizationMembershipListMock.mockReset();
    getCurrentOrgConnectorConnectionMock.mockResolvedValue({
      status: "active",
    });
    getActiveOrgBindingMock.mockResolvedValue({
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
    clerkGetOrganizationMembershipListMock.mockResolvedValue({
      data: [{ organization: { id: "org_1", name: "Acme", slug: "acme" } }],
      totalCount: 1,
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
        orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
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

  it("treats expired native OAuth bearer tokens as unauthenticated", async () => {
    authMock.mockResolvedValueOnce({
      clientId: "desktop_client_test",
      isAuthenticated: false,
      scopes: ["openid", "profile", "email"],
      tokenType: "oauth_token",
      userId: "user_1",
    });

    await expect(
      resolveAuthContextFromClerk({
        db: {} as Database,
        headers: new Headers({
          authorization: "Bearer expired",
          "x-lightfast-native-client": "desktop",
          "x-lightfast-organization-id": "org_1",
        }),
      })
    ).resolves.toEqual({ identity: { type: "unauthenticated" } });
    expect(clerkGetOrganizationMembershipListMock).not.toHaveBeenCalled();
  });

  it("finds native OAuth org memberships beyond Clerk's first page", async () => {
    authMock.mockResolvedValueOnce({
      clientId: "desktop_client_test",
      isAuthenticated: true,
      scopes: ["openid", "profile", "email"],
      tokenType: "oauth_token",
      userId: "user_1",
    });
    clerkGetOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => ({
          organization: { id: `org_other_${index}` },
        })),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [{ organization: { id: "org_2" } }],
        totalCount: 101,
      });

    await expect(
      resolveAuthContextFromClerk({
        db: {} as Database,
        headers: new Headers({
          authorization: "Bearer access",
          "x-lightfast-native-client": "desktop",
          "x-lightfast-organization-id": "org_2",
        }),
      })
    ).resolves.toMatchObject({
      identity: { orgId: "org_2", type: "active" },
    });
    expect(clerkGetOrganizationMembershipListMock).toHaveBeenNthCalledWith(1, {
      limit: 100,
      offset: 0,
      userId: "user_1",
    });
    expect(clerkGetOrganizationMembershipListMock).toHaveBeenNthCalledWith(2, {
      limit: 100,
      offset: 100,
      userId: "user_1",
    });
  });
});
