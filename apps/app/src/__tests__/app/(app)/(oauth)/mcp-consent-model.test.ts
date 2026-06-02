import { beforeEach, describe, expect, it, vi } from "vitest";

class TestMcpOAuthError extends Error {
  constructor(
    public readonly error: string,
    message: string
  ) {
    super(message);
    this.name = "McpOAuthError";
  }
}

const authMock = vi.fn();
const currentUserMock = vi.fn();
const getMcpOauthClientByClientIdMock = vi.fn();
const getOrganizationMembershipListMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const parseMcpScopesMock = vi.fn((scope: string | undefined) => {
  if (scope === "mcp:unknown") {
    throw new TestMcpOAuthError(
      "invalid_request",
      "Unsupported MCP OAuth scope: mcp:unknown."
    );
  }
  return ["mcp:signals:write"];
});

vi.mock("@api/app", () => ({
  isValidMcpS256CodeChallenge: (value: string) =>
    /^[A-Za-z0-9_-]{43}$/.test(value),
  McpOAuthError: TestMcpOAuthError,
  parseMcpScopes: parseMcpScopesMock,
}));

vi.mock("@db/app", () => ({
  getMcpOauthClientByClientId: getMcpOauthClientByClientIdMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: vi.fn(async () => ({
    users: {
      getOrganizationMembershipList: getOrganizationMembershipListMock,
    },
  })),
  currentUser: currentUserMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { getMcpConsentViewModel } = await import(
  "~/app/(app)/(oauth)/oauth/authorize/model"
);

const validRequest = {
  client_id: "mcp_client_test",
  code_challenge: "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabc",
  code_challenge_method: "S256",
  redirect_uri: "https://backend.lightfield.app/connections/callback/MCP",
  resource: "https://mcp.lightfast.localhost/mcp",
  scope: "mcp:signals:write",
};

beforeEach(() => {
  authMock.mockReset();
  currentUserMock.mockReset();
  getMcpOauthClientByClientIdMock.mockReset();
  getOrganizationMembershipListMock.mockReset();
  notFoundMock.mockClear();
  parseMcpScopesMock.mockClear();

  authMock.mockResolvedValue({ userId: "user_test" });
  currentUserMock.mockResolvedValue({
    fullName: "Jeevan",
    primaryEmailAddress: { emailAddress: "dev@example.com" },
    username: null,
  });
  getMcpOauthClientByClientIdMock.mockResolvedValue({
    clientName: "Lightfield",
    publicClientId: "mcp_client_test",
    redirectUris: ["https://backend.lightfield.app/connections/callback/MCP"],
  });
  getOrganizationMembershipListMock.mockResolvedValue({
    data: [
      {
        organization: {
          id: "org_1",
          name: "Acme",
          slug: "acme",
        },
      },
    ],
  });
});

describe("getMcpConsentViewModel", () => {
  it("routes unauthenticated users through notFound", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    await expect(getMcpConsentViewModel(validRequest)).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );

    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(getMcpOauthClientByClientIdMock).not.toHaveBeenCalled();
  });

  it("routes users without organization memberships through notFound", async () => {
    getOrganizationMembershipListMock.mockResolvedValueOnce({ data: [] });

    await expect(getMcpConsentViewModel(validRequest)).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );

    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("routes unsupported scopes through notFound", async () => {
    await expect(
      getMcpConsentViewModel({
        ...validRequest,
        scope: "mcp:unknown",
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
