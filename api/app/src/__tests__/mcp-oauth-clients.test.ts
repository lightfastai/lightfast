import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMcpOauthClientMock = vi.fn();
const getMcpOauthClientByRegistrationTokenHashMock = vi.fn();

vi.mock("@db/app", () => ({
  createMcpOauthClient: createMcpOauthClientMock,
  getMcpOauthClientByRegistrationTokenHash:
    getMcpOauthClientByRegistrationTokenHashMock,
}));

const { getRegisteredMcpOAuthClient, registerMcpOAuthClient } = await import(
  "../mcp-oauth/clients"
);
const { McpOAuthError } = await import("../mcp-oauth/types");

const db = { kind: "mock-db" } as unknown as Database;

beforeEach(() => {
  createMcpOauthClientMock.mockReset();
  getMcpOauthClientByRegistrationTokenHashMock.mockReset();
  createMcpOauthClientMock.mockResolvedValue({
    clientName: "Lightfield",
    clientUri: "https://lightfield.app",
    logoUri: null,
    publicClientId: "mcp_client_test",
    redirectUris: ["https://backend.lightfield.app/connections/callback/MCP"],
  });
  getMcpOauthClientByRegistrationTokenHashMock.mockResolvedValue({
    clientName: "Lightfield",
    clientUri: "https://lightfield.app",
    logoUri: null,
    publicClientId: "mcp_client_test",
    redirectUris: ["https://backend.lightfield.app/connections/callback/MCP"],
  });
});

describe("registerMcpOAuthClient", () => {
  it("accepts public PKCE clients with exact https redirect uris", async () => {
    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Lightfield",
        client_uri: "https://lightfield.app",
        redirect_uris: [
          "https://backend.lightfield.app/connections/callback/MCP",
        ],
        token_endpoint_auth_method: "none",
      })
    ).resolves.toMatchObject({
      client_id: "mcp_client_test",
      client_name: "Lightfield",
      code_challenge_methods_supported: ["S256"],
      redirect_uris: [
        "https://backend.lightfield.app/connections/callback/MCP",
      ],
      token_endpoint_auth_method: "none",
    });

    expect(createMcpOauthClientMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientName: "Lightfield",
        clientUri: "https://lightfield.app",
        redirectUris: [
          "https://backend.lightfield.app/connections/callback/MCP",
        ],
        registrationAccessTokenHash: expect.any(String),
      })
    );
    const persisted = createMcpOauthClientMock.mock.calls[0]?.[1];
    expect(persisted).not.toHaveProperty("registrationAccessToken");
  });

  it("accepts exact loopback redirect uris for native public clients", async () => {
    createMcpOauthClientMock.mockResolvedValueOnce({
      clientName: "Claude Code",
      clientUri: null,
      logoUri: null,
      publicClientId: "mcp_client_test",
      redirectUris: ["http://127.0.0.1:38427/callback"],
    });

    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Claude Code",
        redirect_uris: ["http://127.0.0.1:38427/callback"],
        token_endpoint_auth_method: "none",
      })
    ).resolves.toMatchObject({
      client_id: "mcp_client_test",
      redirect_uris: ["http://127.0.0.1:38427/callback"],
      token_endpoint_auth_method: "none",
    });

    expect(createMcpOauthClientMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientName: "Claude Code",
        redirectUris: ["http://127.0.0.1:38427/callback"],
      })
    );
  });

  it("accepts IPv6 loopback redirect uris for native public clients", async () => {
    createMcpOauthClientMock.mockResolvedValueOnce({
      clientName: "Claude Code",
      clientUri: null,
      logoUri: null,
      publicClientId: "mcp_client_test",
      redirectUris: ["http://[::1]:38427/callback"],
    });

    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Claude Code",
        redirect_uris: ["http://[::1]:38427/callback"],
        token_endpoint_auth_method: "none",
      })
    ).resolves.toMatchObject({
      client_id: "mcp_client_test",
      redirect_uris: ["http://[::1]:38427/callback"],
      token_endpoint_auth_method: "none",
    });

    expect(createMcpOauthClientMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientName: "Claude Code",
        redirectUris: ["http://[::1]:38427/callback"],
      })
    );
  });

  it("accepts loopback redirect uris with an explicit default http port", async () => {
    createMcpOauthClientMock.mockResolvedValueOnce({
      clientName: "Claude Code",
      clientUri: null,
      logoUri: null,
      publicClientId: "mcp_client_test",
      redirectUris: ["http://127.0.0.1:80/callback"],
    });

    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Claude Code",
        redirect_uris: ["http://127.0.0.1:80/callback"],
        token_endpoint_auth_method: "none",
      })
    ).resolves.toMatchObject({
      client_id: "mcp_client_test",
      redirect_uris: ["http://127.0.0.1:80/callback"],
      token_endpoint_auth_method: "none",
    });
  });

  it("rejects non-loopback http redirect uris", async () => {
    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Untrusted",
        redirect_uris: ["http://example.com/callback"],
        token_endpoint_auth_method: "none",
      })
    ).rejects.toEqual(
      new McpOAuthError(
        "invalid_request",
        "Redirect URIs must be exact HTTPS URLs or loopback HTTP URLs with explicit ports and no fragments."
      )
    );

    expect(createMcpOauthClientMock).not.toHaveBeenCalled();
  });

  it("accepts localhost redirect uris for native public clients", async () => {
    createMcpOauthClientMock.mockResolvedValueOnce({
      clientName: "Claude Code",
      clientUri: null,
      logoUri: null,
      publicClientId: "mcp_client_test",
      redirectUris: ["http://localhost:49152/callback"],
    });

    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Claude Code",
        redirect_uris: ["http://localhost:49152/callback"],
        token_endpoint_auth_method: "none",
      })
    ).resolves.toMatchObject({
      client_id: "mcp_client_test",
      redirect_uris: ["http://localhost:49152/callback"],
      token_endpoint_auth_method: "none",
    });

    expect(createMcpOauthClientMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientName: "Claude Code",
        redirectUris: ["http://localhost:49152/callback"],
      })
    );
  });

  it("rejects localhost-like http redirect uris", async () => {
    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Untrusted",
        redirect_uris: ["http://app.localhost:49152/callback"],
        token_endpoint_auth_method: "none",
      })
    ).rejects.toEqual(
      new McpOAuthError(
        "invalid_request",
        "Redirect URIs must be exact HTTPS URLs or loopback HTTP URLs with explicit ports and no fragments."
      )
    );

    expect(createMcpOauthClientMock).not.toHaveBeenCalled();
  });

  it("rejects loopback http redirect uris without an explicit port", async () => {
    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Untrusted",
        redirect_uris: ["http://127.0.0.1/callback"],
        token_endpoint_auth_method: "none",
      })
    ).rejects.toEqual(
      new McpOAuthError(
        "invalid_request",
        "Redirect URIs must be exact HTTPS URLs or loopback HTTP URLs with explicit ports and no fragments."
      )
    );

    expect(createMcpOauthClientMock).not.toHaveBeenCalled();
  });

  it("rejects wildcard redirect uris", async () => {
    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Lightfield",
        redirect_uris: ["https://*.lightfield.app/callback"],
        token_endpoint_auth_method: "none",
      })
    ).rejects.toEqual(
      new McpOAuthError(
        "invalid_request",
        "Wildcard redirect URIs are not allowed."
      )
    );

    expect(createMcpOauthClientMock).not.toHaveBeenCalled();
  });

  it("rejects private metadata urls", async () => {
    await expect(
      registerMcpOAuthClient(db, {
        client_name: "Lightfield",
        client_uri: "https://127.0.0.1/app",
        redirect_uris: [
          "https://backend.lightfield.app/connections/callback/MCP",
        ],
        token_endpoint_auth_method: "none",
      })
    ).rejects.toMatchObject({
      error: "invalid_request",
      message: expect.stringContaining("client_uri"),
    });

    expect(createMcpOauthClientMock).not.toHaveBeenCalled();
  });

  it("reads client metadata with a registration access token", async () => {
    await expect(
      getRegisteredMcpOAuthClient(db, {
        registrationAccessToken: "mcp_reg_secret",
      })
    ).resolves.toMatchObject({
      client_id: "mcp_client_test",
      client_name: "Lightfield",
      redirect_uris: [
        "https://backend.lightfield.app/connections/callback/MCP",
      ],
    });

    expect(getMcpOauthClientByRegistrationTokenHashMock).toHaveBeenCalledWith(
      db,
      { tokenHash: expect.any(String) }
    );
  });
});
