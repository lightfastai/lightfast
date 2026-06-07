import type { SignalEntityEnrichmentTargetsResult } from "@db/app";
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const executeXApiToolMock = vi.fn();
const getActiveOrgBindingMock = vi.fn();
const getCachedGitHubInstallationTokenMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const getFreshXConnectorAccessTokenMock = vi.fn();
const getGitHubUserByLoginMock = vi.fn();

const db = { kind: "mock-db" } as unknown as Database;

const envMock = {
  GITHUB_API_VERSION: "2022-11-28",
  GITHUB_APP_CLIENT_ID: "github_client_test",
  GITHUB_APP_CLIENT_SECRET: "github_secret_test",
  GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
  GITHUB_APP_ID: "12345",
  GITHUB_APP_PRIVATE_KEY: "test-private-key",
  GITHUB_APP_SLUG: "lightfast-test",
  NEXT_PUBLIC_APP_URL: "https://app.lightfast.localhost",
  VERCEL_ENV: "development" as const,
  X_API_ORIGIN: "https://x.lightfast.localhost",
  X_CLIENT_ID: "x_client_test",
  X_CLIENT_SECRET: "x_secret_test",
  X_MCP_ENDPOINT: "https://app.lightfast.localhost/api/connectors/x/mcp",
  X_OAUTH_ORIGIN: "https://x.lightfast.localhost",
};

vi.mock("@db/app", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@db/app")>();
  return {
    ...actual,
    getActiveOrgBinding: getActiveOrgBindingMock,
    getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  };
});
vi.mock("@db/app/client", () => ({ db }));
vi.mock("@repo/github-app-node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/github-app-node")>();
  return {
    ...actual,
    getGitHubUserByLogin: getGitHubUserByLoginMock,
  };
});
vi.mock("@repo/x-app-node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/x-app-node")>();
  return {
    ...actual,
    executeXApiTool: executeXApiToolMock,
  };
});
vi.mock("../env", () => ({ env: envMock }));
vi.mock("../services/connectors/x-mcp-bridge", () => ({
  getFreshXConnectorAccessToken: getFreshXConnectorAccessTokenMock,
}));
vi.mock("../services/github/installation-token-cache", () => ({
  getCachedGitHubInstallationToken: getCachedGitHubInstallationTokenMock,
}));

const { fetchSignalEntityProfiles } = await import(
  "../services/entity-enrichment/provider-fetchers"
);

function targets(): SignalEntityEnrichmentTargetsResult {
  return {
    github: [
      {
        linkIds: [3],
        normalizedValue: "avachen",
        provider: "github",
        value: "avachen",
      },
    ],
    skipped: [],
    x: [
      {
        linkIds: [1, 2],
        normalizedValue: "ava_ai",
        provider: "x",
        value: "ava_ai",
      },
    ],
  };
}

beforeEach(() => {
  executeXApiToolMock.mockReset();
  executeXApiToolMock.mockResolvedValue({
    content: [{ text: "ok", type: "text" }],
    structuredContent: {
      data: [
        {
          description: "Founder at Acme.",
          id: "x_1",
          name: "Ava Chen",
          username: "ava_ai",
        },
      ],
    },
  });
  getActiveOrgBindingMock.mockReset();
  getActiveOrgBindingMock.mockResolvedValue({
    provider: "github",
    providerInstallationId: "1001",
  });
  getCachedGitHubInstallationTokenMock.mockReset();
  getCachedGitHubInstallationTokenMock.mockResolvedValue("ghs_installation");
  getCurrentOrgConnectorConnectionMock.mockReset();
  getCurrentOrgConnectorConnectionMock.mockResolvedValue({
    clerkOrgId: "org_test",
    provider: "x",
    status: "active",
  });
  getFreshXConnectorAccessTokenMock.mockReset();
  getFreshXConnectorAccessTokenMock.mockResolvedValue("x_access_token");
  getGitHubUserByLoginMock.mockReset();
  getGitHubUserByLoginMock.mockResolvedValue({
    company: "Acme",
    id: "12345",
    login: "avachen",
    name: "Ava Chen",
    twitterUsername: "ava_ai",
    type: "User",
  });
});

describe("fetchSignalEntityProfiles", () => {
  it("returns diagnostics instead of fetching when provider access is missing", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(null);
    getActiveOrgBindingMock.mockResolvedValueOnce(undefined);

    await expect(
      fetchSignalEntityProfiles({
        clerkOrgId: "org_test",
        targets: targets(),
      })
    ).resolves.toEqual({
      diagnostics: {
        github_missing_binding: 1,
        x_missing_connection: 1,
      },
      githubPayloads: [],
      xPayloads: [],
    });

    expect(executeXApiToolMock).not.toHaveBeenCalled();
    expect(getCachedGitHubInstallationTokenMock).not.toHaveBeenCalled();
    expect(getGitHubUserByLoginMock).not.toHaveBeenCalled();
  });

  it("fetches X and GitHub profiles with org-scoped provider credentials", async () => {
    await expect(
      fetchSignalEntityProfiles({
        clerkOrgId: "org_test",
        targets: targets(),
      })
    ).resolves.toEqual({
      diagnostics: {},
      githubPayloads: [
        {
          company: "Acme",
          id: "12345",
          login: "avachen",
          name: "Ava Chen",
          twitterUsername: "ava_ai",
          type: "User",
        },
      ],
      xPayloads: [
        {
          description: "Founder at Acme.",
          id: "x_1",
          name: "Ava Chen",
          username: "ava_ai",
        },
      ],
    });

    expect(getCurrentOrgConnectorConnectionMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      provider: "x",
    });
    expect(getFreshXConnectorAccessTokenMock).toHaveBeenCalledWith({
      config: expect.objectContaining({
        clientId: "x_client_test",
        endpoints: expect.objectContaining({
          apiOrigin: "https://x.lightfast.localhost",
        }),
      }),
      connection: expect.objectContaining({ provider: "x" }),
    });
    expect(executeXApiToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "x_access_token",
        apiOrigin: "https://x.lightfast.localhost",
        input: { usernames: ["ava_ai"] },
        name: "getUsersByUsernames",
      })
    );
    expect(getActiveOrgBindingMock).toHaveBeenCalledWith(db, "org_test");
    expect(getCachedGitHubInstallationTokenMock).toHaveBeenCalledWith({
      installationId: "1001",
    });
    expect(getGitHubUserByLoginMock).toHaveBeenCalledWith({
      apiBaseUrl: "https://github.lightfast.localhost",
      apiVersion: "2022-11-28",
      login: "avachen",
      token: "ghs_installation",
    });
  });
});
