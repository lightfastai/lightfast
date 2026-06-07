import type { OrgConnectorConnection } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const decryptMock = vi.fn();
const encryptMock = vi.fn();
const executeXApiToolMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const markCurrentOrgConnectorConnectionErrorMock = vi.fn();
const refreshXOAuthTokenMock = vi.fn();
const updateObservedConnectorTokensMock = vi.fn();

const envMock = {
  CONNECTOR_MCP_AUTH_SECRET: "mcp_auth_secret_12345678901234567890",
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
  NEXT_PUBLIC_APP_URL: "https://app.lightfast.localhost",
  VERCEL_ENV: "development",
  X_API_ORIGIN: "https://x.test",
  X_CLIENT_ID: "x_client_test",
  X_CLIENT_SECRET: "x_secret_test",
  X_MCP_ENDPOINT: "https://app.lightfast.localhost/api/connectors/x/mcp",
  X_OAUTH_ORIGIN: "https://x.test",
};

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  markCurrentOrgConnectorConnectionError:
    markCurrentOrgConnectorConnectionErrorMock,
  updateObservedConnectorTokens: updateObservedConnectorTokensMock,
}));

vi.mock("@repo/app-encryption", () => ({
  decrypt: decryptMock,
  encrypt: encryptMock,
}));

vi.mock("@repo/x-app-node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/x-app-node")>();
  return {
    ...actual,
    executeXApiTool: executeXApiToolMock,
    refreshXOAuthToken: refreshXOAuthTokenMock,
  };
});

vi.mock("../env", () => ({ env: envMock }));

const { issueConnectorMcpToken } = await import(
  "../services/connectors/mcp-auth"
);
const { handleXConnectorMcpRequest } = await import(
  "../services/connectors/x-mcp-bridge"
);
const { X_OAUTH_SCOPES } = await import("@repo/x-app-node");

function connection(
  overrides: Partial<OrgConnectorConnection> = {}
): OrgConnectorConnection {
  return {
    accessTokenExpiresAt: new Date("2099-06-01T08:00:00.000Z"),
    clerkOrgId: "org_acme",
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    connectedByUserId: "user_current",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    encryptedAccessToken: "encrypted_x_access",
    encryptedRefreshToken: "encrypted_x_refresh",
    enabledForAutomations: true,
    enabledForAgents: true,
    id: 42,
    lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
    lastToolRefreshErrorAt: null,
    lastToolRefreshErrorCode: null,
    mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
    metadata: {},
    provider: "x",
    providerActorId: "x_user_1",
    providerActorName: "@lightfast",
    providerWorkspaceId: null,
    providerWorkspaceName: "X",
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
    scopes: ["tweet.read", "users.read", "offline.access"],
    status: "active",
    toolManifest: [{ description: "Look up account", name: "getUsersMe" }],
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function mcpRequest(input: { body: unknown; token?: string }) {
  return new Request("https://app.lightfast.localhost/api/connectors/x/mcp", {
    body: JSON.stringify(input.body),
    headers: {
      accept: "application/json, text/event-stream",
      ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  });
}

function malformedRequest() {
  return new Request("https://app.lightfast.localhost/api/connectors/x/mcp", {
    body: "{bad json",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    method: "POST",
  });
}

async function mcpToken(input: {
  purpose: "call" | "list";
  clerkOrgId?: string;
  toolName?: string;
  now?: Date;
}) {
  return await issueConnectorMcpToken({
    clerkOrgId: input.clerkOrgId ?? "org_acme",
    connectionId: 42,
    provider: "x",
    purpose: input.purpose,
    toolName: input.toolName,
    ...(input.now ? { now: input.now } : {}),
  });
}

describe("X MCP bridge service", () => {
  beforeEach(() => {
    decryptMock.mockReset();
    decryptMock.mockResolvedValue("x_access_token");
    encryptMock.mockReset();
    encryptMock.mockImplementation(
      async (value: string) => `encrypted:${value}`
    );
    executeXApiToolMock.mockReset();
    executeXApiToolMock.mockResolvedValue({
      content: [{ text: "X tool getUsersMe completed.", type: "text" }],
      structuredContent: { data: { id: "x_user_1" } },
    });
    getCurrentOrgConnectorConnectionMock.mockReset();
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    markCurrentOrgConnectorConnectionErrorMock.mockReset();
    markCurrentOrgConnectorConnectionErrorMock.mockResolvedValue(undefined);
    refreshXOAuthTokenMock.mockReset();
    updateObservedConnectorTokensMock.mockReset();
  });

  it("rejects requests without Authorization", async () => {
    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: { id: 1, jsonrpc: "2.0", method: "tools/list" },
      }),
    });

    expect(response.status).toBe(401);
    expect(getCurrentOrgConnectorConnectionMock).not.toHaveBeenCalled();
  });

  it("rejects invalid Lightfast MCP tokens", async () => {
    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: { id: 1, jsonrpc: "2.0", method: "tools/list" },
        token: "lfmcp_v1.invalid.payload.signature",
      }),
    });

    expect(response.status).toBe(401);
    expect(getCurrentOrgConnectorConnectionMock).not.toHaveBeenCalled();
  });

  it("lists X tools with a purpose=list token", async () => {
    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: { id: 1, jsonrpc: "2.0", method: "tools/list" },
        token: await mcpToken({ purpose: "list" }),
      }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.result.tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "getUsersMe" })])
    );
    expect(getCurrentOrgConnectorConnectionMock).toHaveBeenCalledWith(
      {},
      { clerkOrgId: "org_acme", provider: "x" }
    );
    expect(decryptMock).not.toHaveBeenCalled();
  });

  it("filters listed X tools by stored connection scopes", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({ scopes: ["tweet.read", "users.read", "offline.access"] })
    );

    const readOnlyResponse = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: { id: 1, jsonrpc: "2.0", method: "tools/list" },
        token: await mcpToken({ purpose: "list" }),
      }),
    });
    const readOnlyJson = await readOnlyResponse.json();
    expect(
      readOnlyJson.result.tools.map((tool: { name: string }) => tool.name)
    ).toContain("getUsersMe");
    expect(
      readOnlyJson.result.tools.map((tool: { name: string }) => tool.name)
    ).not.toContain("createPost");

    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({
        scopes: [...X_OAUTH_SCOPES],
        toolManifest: [
          { description: "Look up account", name: "getUsersMe" },
          { description: "Create post", name: "createPost" },
        ],
      })
    );

    const writeResponse = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: { id: 2, jsonrpc: "2.0", method: "tools/list" },
        token: await mcpToken({ purpose: "list" }),
      }),
    });
    const writeJson = await writeResponse.json();
    expect(
      writeJson.result.tools.map((tool: { name: string }) => tool.name)
    ).toContain("createPost");
  });

  it("filters listed X tools by the stored tool manifest", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({
        scopes: [...X_OAUTH_SCOPES],
        toolManifest: [{ description: "Look up account", name: "getUsersMe" }],
      })
    );

    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: { id: 1, jsonrpc: "2.0", method: "tools/list" },
        token: await mcpToken({ purpose: "list" }),
      }),
    });
    const json = await response.json();
    const names = json.result.tools.map((tool: { name: string }) => tool.name);

    expect(response.status).toBe(200);
    expect(names).toContain("getUsersMe");
    expect(names).not.toContain("createPost");
  });

  it("calls X tools with a matching purpose=call token", async () => {
    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: {}, name: "getUsersMe" },
        },
        token: await mcpToken({ purpose: "call", toolName: "getUsersMe" }),
      }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      result: {
        structuredContent: {
          data: { id: "x_user_1" },
        },
      },
    });
    expect(executeXApiToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "x_access_token",
        apiOrigin: "https://x.test",
        connectedActorId: "x_user_1",
        input: {},
        name: "getUsersMe",
      })
    );
  });

  it("rejects write tool calls missing granted scopes", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [{ name: "createPost" }],
      })
    );

    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: { text: "ship it" }, name: "createPost" },
        },
        token: await mcpToken({ purpose: "call", toolName: "createPost" }),
      }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.result?.isError ?? Boolean(json.error)).toBe(true);
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });

  it("rejects write tool calls missing from the current manifest", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({
        scopes: [...X_OAUTH_SCOPES],
        toolManifest: [{ name: "getUsersMe" }],
      })
    );

    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: { text: "ship it" }, name: "createPost" },
        },
        token: await mcpToken({ purpose: "call", toolName: "createPost" }),
      }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.result?.isError ?? Boolean(json.error)).toBe(true);
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });

  it("passes connected actor id into write tool execution", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({
        scopes: [...X_OAUTH_SCOPES],
        toolManifest: [{ name: "likePost" }],
      })
    );

    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: { tweet_id: "tweet_1" }, name: "likePost" },
        },
        token: await mcpToken({ purpose: "call", toolName: "likePost" }),
      }),
    });

    expect(response.status).toBe(200);
    expect(executeXApiToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectedActorId: "x_user_1",
        input: { tweet_id: "tweet_1" },
        name: "likePost",
      })
    );
  });

  it("rejects tool calls when the call token is scoped to a different tool", async () => {
    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            arguments: { username: "lightfast" },
            name: "getUsersByUsername",
          },
        },
        token: await mcpToken({ purpose: "call", toolName: "getUsersMe" }),
      }),
    });

    expect(response.status).toBe(401);
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });

  it("rejects requests when the request body is not valid JSON", async () => {
    const response = await handleXConnectorMcpRequest({
      request: malformedRequest(),
    });

    expect(response.status).toBe(400);
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });

  it("rejects requests when the connector connection is missing", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(null);

    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
          params: {},
        },
        token: await mcpToken({ purpose: "list" }),
      }),
    });

    expect(response.status).toBe(401);
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });

  it("rejects requests when the connector connection id does not match the token", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({ id: 43 })
    );

    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
        },
        token: await mcpToken({ purpose: "list" }),
      }),
    });

    expect(response.status).toBe(401);
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });

  it("rejects requests when the connector connection is not active", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({ status: "revoked" })
    );

    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
        },
        token: await mcpToken({ purpose: "list" }),
      }),
    });

    expect(response.status).toBe(401);
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });

  it("rejects requests when the token clerk org id does not match any connection", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(null);

    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
          params: {},
        },
        token: await mcpToken({
          clerkOrgId: "org_other",
          purpose: "list",
        }),
      }),
    });

    expect(response.status).toBe(401);
    expect(getCurrentOrgConnectorConnectionMock).toHaveBeenCalledWith(
      {},
      {
        clerkOrgId: "org_other",
        provider: "x",
      }
    );
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });

  it("rejects expired tokens before any tool execution", async () => {
    const response = await handleXConnectorMcpRequest({
      request: mcpRequest({
        body: {
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
          params: {},
        },
        token: await mcpToken({
          purpose: "list",
          now: new Date(Date.now() - 600_000),
        }),
      }),
    });

    expect(response.status).toBe(401);
    expect(getCurrentOrgConnectorConnectionMock).not.toHaveBeenCalled();
    expect(executeXApiToolMock).not.toHaveBeenCalled();
  });
});
