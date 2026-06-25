import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class McpOAuthError extends Error {
    constructor(
      readonly error: string,
      message: string,
      readonly status = 400
    ) {
      super(message);
      this.name = "McpOAuthError";
    }
  }

  return {
    auth: vi.fn(),
    clerkClient: vi.fn(),
    currentUser: vi.fn(),
    db: { kind: "mock-db" },
    getMcpOauthClientByClientId: vi.fn(),
    issueMcpAuthorizationCode: vi.fn(),
    McpOAuthError,
    notFound: vi.fn(() => {
      throw new Error("not found");
    }),
    parseMcpScopes: vi.fn(() => ["mcp:system:read"]),
    redirect: vi.fn((input) => {
      throw input;
    }),
    requireHostedMcpResource: vi.fn((resource: string) => {
      if (resource !== "https://mcp.lightfast.localhost/mcp") {
        throw new McpOAuthError("invalid_request", "Unsupported MCP resource.");
      }
      return resource;
    }),
    setResponseHeader: vi.fn(),
  };
});

vi.mock("@db/app", () => ({
  getMcpOauthClientByClientId: mocks.getMcpOauthClientByClientId,
}));

vi.mock("@db/app/client", () => ({
  db: mocks.db,
}));

vi.mock("@tanstack/react-router", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (
      validator:
        | ((input: unknown) => unknown)
        | { parse: (input: unknown) => unknown }
    ) => ({
      handler:
        (handler: (input: { data: unknown }) => unknown) =>
        (input: { data: unknown }) => {
          const data =
            typeof validator === "function"
              ? validator(input.data)
              : validator.parse(input.data);
          return handler({ data });
        },
    }),
  }),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://lightfast.localhost/oauth/authorize"),
  setResponseHeader: mocks.setResponseHeader,
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: mocks.auth,
  clerkClient: mocks.clerkClient,
  currentUser: mocks.currentUser,
}));

vi.mock("../mcp-oauth", () => ({
  issueMcpAuthorizationCode: mocks.issueMcpAuthorizationCode,
  isValidMcpS256CodeChallenge: () => true,
  McpOAuthError: mocks.McpOAuthError,
  parseMcpScopes: mocks.parseMcpScopes,
  requireHostedMcpResource: mocks.requireHostedMcpResource,
}));

const {
  approveMcpAuthorization,
  denyMcpAuthorization,
  loadMcpConsentViewModel,
} = await import("../adapters/tanstack/mcp-consent");

const baseInput = {
  clientId: "mcp_client_test",
  codeChallenge: "c".repeat(43),
  codeChallengeMethod: "S256",
  organizationId: "org_test",
  redirectUri: "https://client.example/callback",
  resource: "https://mcp.lightfast.localhost/mcp",
  scope: "mcp:system:read",
  state: "state_test",
} as const;

describe("MCP consent TanStack adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user_test" });
    mocks.clerkClient.mockResolvedValue({
      users: {
        getOrganizationMembershipList: vi.fn().mockResolvedValue({
          data: [
            {
              organization: {
                id: "org_test",
                name: "Test Org",
                slug: "test-org",
              },
            },
          ],
        }),
      },
    });
    mocks.currentUser.mockResolvedValue({
      fullName: "Test User",
      primaryEmailAddress: { emailAddress: "test@lightfast.ai" },
    });
    mocks.getMcpOauthClientByClientId.mockResolvedValue({
      redirectUris: ["https://client.example/callback"],
    });
    mocks.issueMcpAuthorizationCode.mockResolvedValue({
      code: "mcp_code_test",
    });
  });

  it("rejects approval requests for unsupported MCP resources before issuing a code", async () => {
    await expect(
      approveMcpAuthorization({
        data: {
          ...baseInput,
          resource: "https://attacker.example/mcp",
        },
      })
    ).rejects.toThrow("Unsupported MCP resource.");

    expect(mocks.issueMcpAuthorizationCode).not.toHaveBeenCalled();
  });

  it("rejects denial requests for unsupported MCP resources before looking up the redirect URI", async () => {
    await expect(
      denyMcpAuthorization({
        data: {
          ...baseInput,
          resource: "https://attacker.example/mcp",
        },
      })
    ).rejects.toThrow("Unsupported MCP resource.");

    expect(mocks.getMcpOauthClientByClientId).not.toHaveBeenCalled();
  });

  it("passes the validated hosted resource into authorization code issuance", async () => {
    await expect(
      approveMcpAuthorization({ data: baseInput })
    ).resolves.toContain("code=mcp_code_test");

    expect(mocks.issueMcpAuthorizationCode).toHaveBeenCalledWith(mocks.db, {
      clientId: "mcp_client_test",
      clerkOrgId: "org_test",
      clerkUserId: "user_test",
      codeChallenge: "c".repeat(43),
      codeChallengeMethod: "S256",
      redirectUri: "https://client.example/callback",
      resource: "https://mcp.lightfast.localhost/mcp",
      scope: "mcp:system:read",
    });
  });

  it("rejects consent view models when the user has no organizations", async () => {
    const clerk = await mocks.clerkClient();
    clerk.users.getOrganizationMembershipList.mockResolvedValueOnce({
      data: [],
    });

    await expect(
      loadMcpConsentViewModel({
        data: {
          client_id: "mcp_client_test",
          code_challenge: "c".repeat(43),
          code_challenge_method: "S256",
          redirect_uri: "https://client.example/callback",
          resource: "https://mcp.lightfast.localhost/mcp",
          response_type: "code",
          scope: "mcp:system:read",
          state: "state_test",
        },
      })
    ).rejects.toThrow("not found");
  });

  it("rejects approval requests for organizations outside the current user's memberships", async () => {
    await expect(
      approveMcpAuthorization({
        data: {
          ...baseInput,
          organizationId: "org_other",
        },
      })
    ).rejects.toThrow("Organization access denied.");

    expect(mocks.issueMcpAuthorizationCode).not.toHaveBeenCalled();
  });

  it("accepts identical duplicate resource search params from MCP clients", async () => {
    await expect(
      loadMcpConsentViewModel({
        data: {
          client_id: "mcp_client_test",
          code_challenge: "c".repeat(43),
          code_challenge_method: "S256",
          redirect_uri: "https://client.example/callback",
          resource: [
            "https://mcp.lightfast.localhost/mcp",
            "https://mcp.lightfast.localhost/mcp",
          ],
          response_type: "code",
          scope: "mcp:system:read",
          state: "state_test",
        },
      })
    ).resolves.toMatchObject({
      request: {
        resource: "https://mcp.lightfast.localhost/mcp",
      },
    });
  });

  it("rejects conflicting duplicate resource search params", async () => {
    await expect(
      loadMcpConsentViewModel({
        data: {
          client_id: "mcp_client_test",
          code_challenge: "c".repeat(43),
          code_challenge_method: "S256",
          redirect_uri: "https://client.example/callback",
          resource: [
            "https://mcp.lightfast.localhost/mcp",
            "https://attacker.example/mcp",
          ],
          response_type: "code",
          scope: "mcp:system:read",
          state: "state_test",
        },
      })
    ).rejects.toThrow("not found");
  });

  it("rejects malformed duplicate resource search params", async () => {
    await expect(
      loadMcpConsentViewModel({
        data: {
          client_id: "mcp_client_test",
          code_challenge: "c".repeat(43),
          code_challenge_method: "S256",
          redirect_uri: "https://client.example/callback",
          resource: ["https://mcp.lightfast.localhost/mcp", ""],
          response_type: "code",
          scope: "mcp:system:read",
          state: "state_test",
        },
      })
    ).rejects.toThrow("not found");
  });
});
