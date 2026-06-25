import type { McpScope } from "@repo/api-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecuteHostedMcpToolDependencies } from "../tools/execute";

interface Database {
  kind: "e2e-mock-db";
}

interface McpOauthClientWithRedirectUris {
  clientName: string;
  clientUri: string | null;
  contacts: string[] | null;
  createdAt: Date;
  id: number;
  logoUri: string | null;
  metadata: Record<string, unknown> | null;
  publicClientId: string;
  redirectUris: string[];
  status: "active";
  updatedAt: Date;
}

interface McpOauthAuthorizationCode {
  clerkOrgId: string;
  clerkUserId: string;
  clientPublicId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  codeHash: string;
  consumedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  id: number;
  redirectUri: string;
  resource: string;
  resourceHash: string;
  scopes: McpScope[];
  updatedAt: Date;
}

interface McpOauthGrant {
  clerkOrgId: string;
  clerkUserId: string;
  clientPublicId: string;
  createdAt: Date;
  id: number;
  lastUsedAt: Date | null;
  metadata: Record<string, unknown> | null;
  publicId: string;
  resource: string;
  resourceHash: string;
  revokedAt: Date | null;
  scopes: McpScope[];
  status: "active" | "revoked";
  updatedAt: Date;
}

interface McpOauthRefreshToken {
  clerkOrgId: string;
  clerkUserId: string;
  clientPublicId: string;
  createdAt: Date;
  expiresAt: Date;
  grantPublicId: string;
  id: number;
  parentTokenHash: string | null;
  reuseDetectedAt: Date | null;
  rotatedToTokenHash: string | null;
  status: "active" | "reuse_detected" | "revoked" | "rotated";
  tokenHash: string;
  updatedAt: Date;
}

vi.mock("server-only", () => ({}));
vi.mock("@tanstack/react-start/server-only", () => ({}));

const consumeMcpAuthorizationCodeMock = vi.fn();
const createMcpAuthorizationCodeMock = vi.fn();
const createMcpOauthClientMock = vi.fn();
const createMcpOauthGrantMock = vi.fn();
const createMcpRefreshTokenMock = vi.fn();
const getActiveMcpOauthGrantMock = vi.fn();
const getActiveOrgBindingMock = vi.fn();
const getMcpOauthClientByClientIdMock = vi.fn();
const getMcpOauthClientByRegistrationTokenHashMock = vi.fn();
const getMcpOauthGrantByPublicIdMock = vi.fn();
const revokeMcpOauthGrantMock = vi.fn();
const revokeMcpRefreshTokenByHashMock = vi.fn();
const rotateMcpRefreshTokenMock = vi.fn();

vi.mock("@db/app", () => ({
  consumeMcpAuthorizationCode: consumeMcpAuthorizationCodeMock,
  createMcpAuthorizationCode: createMcpAuthorizationCodeMock,
  createMcpOauthClient: createMcpOauthClientMock,
  createMcpOauthGrant: createMcpOauthGrantMock,
  createMcpRefreshToken: createMcpRefreshTokenMock,
  getActiveMcpOauthGrant: getActiveMcpOauthGrantMock,
  getActiveOrgBinding: getActiveOrgBindingMock,
  getMcpOauthClientByClientId: getMcpOauthClientByClientIdMock,
  getMcpOauthClientByRegistrationTokenHash:
    getMcpOauthClientByRegistrationTokenHashMock,
  getMcpOauthGrantByPublicId: getMcpOauthGrantByPublicIdMock,
  revokeMcpOauthGrant: revokeMcpOauthGrantMock,
  revokeMcpRefreshTokenByHash: revokeMcpRefreshTokenByHashMock,
  rotateMcpRefreshToken: rotateMcpRefreshTokenMock,
}));

vi.mock("../../../../db/app/src/index.ts", () => ({
  consumeMcpAuthorizationCode: consumeMcpAuthorizationCodeMock,
  createMcpAuthorizationCode: createMcpAuthorizationCodeMock,
  createMcpOauthClient: createMcpOauthClientMock,
  createMcpOauthGrant: createMcpOauthGrantMock,
  createMcpRefreshToken: createMcpRefreshTokenMock,
  getActiveMcpOauthGrant: getActiveMcpOauthGrantMock,
  getActiveOrgBinding: getActiveOrgBindingMock,
  getMcpOauthClientByClientId: getMcpOauthClientByClientIdMock,
  getMcpOauthClientByRegistrationTokenHash:
    getMcpOauthClientByRegistrationTokenHashMock,
  getMcpOauthGrantByPublicId: getMcpOauthGrantByPublicIdMock,
  revokeMcpOauthGrant: revokeMcpOauthGrantMock,
  revokeMcpRefreshTokenByHash: revokeMcpRefreshTokenByHashMock,
  rotateMcpRefreshToken: rotateMcpRefreshTokenMock,
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

const db = { kind: "e2e-mock-db" } as never;
const now = new Date("2026-06-01T00:00:00.000Z");
const issuer = "https://app.lightfast.localhost";
const jwtSecret = "test-mcp-jwt-secret-test-mcp-jwt-secret";
const orgId = "org_test";
const redirectUri = "https://backend.lightfield.app/connections/callback/MCP";
const resource = "https://mcp.lightfast.localhost/mcp";
const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const userId = "user_test";

let nextId = 1;
let authorizationCodesByHash = new Map<string, McpOauthAuthorizationCode>();
let clientsById = new Map<string, McpOauthClientWithRedirectUris>();
let grantsById = new Map<string, McpOauthGrant>();
let refreshTokensByHash = new Map<string, McpOauthRefreshToken>();

beforeEach(() => {
  vi.stubEnv("MCP_AUTH_ISSUER", issuer);
  vi.stubEnv("MCP_RESOURCE_URL", resource);
  vi.stubEnv("SERVICE_JWT_SECRET", jwtSecret);

  nextId = 1;
  authorizationCodesByHash = new Map();
  clientsById = new Map();
  grantsById = new Map();
  refreshTokensByHash = new Map();

  consumeMcpAuthorizationCodeMock.mockReset();
  createMcpAuthorizationCodeMock.mockReset();
  createMcpOauthClientMock.mockReset();
  createMcpOauthGrantMock.mockReset();
  createMcpRefreshTokenMock.mockReset();
  getActiveMcpOauthGrantMock.mockReset();
  getActiveOrgBindingMock.mockReset();
  getMcpOauthClientByClientIdMock.mockReset();
  getMcpOauthClientByRegistrationTokenHashMock.mockReset();
  getMcpOauthGrantByPublicIdMock.mockReset();
  revokeMcpOauthGrantMock.mockReset();
  revokeMcpRefreshTokenByHashMock.mockReset();
  rotateMcpRefreshTokenMock.mockReset();

  createMcpOauthClientMock.mockImplementation(
    async (
      _db: Database,
      input: {
        clientName: string;
        clientUri?: string | null;
        contacts?: string[] | null;
        logoUri?: string | null;
        metadata?: Record<string, unknown> | null;
        publicClientId?: string;
        redirectUris: string[];
      }
    ) => {
      const client = makeClient({
        clientName: input.clientName,
        clientUri: input.clientUri ?? null,
        contacts: input.contacts ?? null,
        logoUri: input.logoUri ?? null,
        metadata: input.metadata ?? null,
        publicClientId: input.publicClientId ?? `mcp_client_${nextId++}`,
        redirectUris: input.redirectUris,
      });
      clientsById.set(client.publicClientId, client);
      return client;
    }
  );
  getMcpOauthClientByClientIdMock.mockImplementation(
    async (_db: Database, input: { publicClientId: string }) =>
      clientsById.get(input.publicClientId)
  );
  getMcpOauthClientByRegistrationTokenHashMock.mockImplementation(
    async () => undefined
  );
  getMcpOauthGrantByPublicIdMock.mockImplementation(
    async (_db: Database, input: { publicId: string }) =>
      grantsById.get(input.publicId)
  );

  createMcpAuthorizationCodeMock.mockImplementation(
    async (
      _db: Database,
      input: {
        clientPublicId: string;
        clerkOrgId: string;
        clerkUserId: string;
        codeChallenge: string;
        codeChallengeMethod: "S256";
        codeHash: string;
        expiresAt: Date;
        redirectUri: string;
        resource: string;
        scopes: McpScope[];
      }
    ) => {
      const code = makeAuthorizationCode(input);
      authorizationCodesByHash.set(code.codeHash, code);
      return code;
    }
  );
  consumeMcpAuthorizationCodeMock.mockImplementation(
    async (_db: Database, input: { codeHash: string }) => {
      const code = authorizationCodesByHash.get(input.codeHash);
      if (!code || code.consumedAt || code.expiresAt <= now) {
        return;
      }
      const consumed = { ...code, consumedAt: now, updatedAt: now };
      authorizationCodesByHash.set(input.codeHash, consumed);
      return consumed;
    }
  );

  getActiveMcpOauthGrantMock.mockImplementation(
    async (
      _db: Database,
      input: {
        clientPublicId: string;
        clerkOrgId: string;
        clerkUserId: string;
        resource: string;
      }
    ) =>
      [...grantsById.values()].find(
        (grant) =>
          grant.status === "active" &&
          grant.clientPublicId === input.clientPublicId &&
          grant.clerkOrgId === input.clerkOrgId &&
          grant.clerkUserId === input.clerkUserId &&
          grant.resource === input.resource
      )
  );
  createMcpOauthGrantMock.mockImplementation(
    async (
      _db: Database,
      input: {
        clientPublicId: string;
        clerkOrgId: string;
        clerkUserId: string;
        resource: string;
        scopes: McpScope[];
      }
    ) => {
      const grant = makeGrant(input);
      grantsById.set(grant.publicId, grant);
      return grant;
    }
  );
  revokeMcpOauthGrantMock.mockImplementation(
    async (_db: Database, input: { publicId: string }) => {
      const grant = grantsById.get(input.publicId);
      if (!grant || grant.status !== "active") {
        return false;
      }
      grantsById.set(input.publicId, {
        ...grant,
        revokedAt: now,
        status: "revoked",
        updatedAt: now,
      });
      return true;
    }
  );

  createMcpRefreshTokenMock.mockImplementation(
    async (
      _db: Database,
      input: {
        clientPublicId: string;
        clerkOrgId: string;
        clerkUserId: string;
        expiresAt: Date;
        grantPublicId: string;
        parentTokenHash?: string | null;
        tokenHash: string;
      }
    ) => {
      const token = makeRefreshToken(input);
      refreshTokensByHash.set(token.tokenHash, token);
      return token;
    }
  );
  rotateMcpRefreshTokenMock.mockImplementation(
    async (
      _db: Database,
      input: {
        currentTokenHash: string;
        expiresAt: Date;
        nextTokenHash: string;
      }
    ) => {
      const current = refreshTokensByHash.get(input.currentTokenHash);
      if (!current) {
        return { refreshToken: undefined, reuseDetected: true };
      }
      if (current.status !== "active") {
        const reused = {
          ...current,
          reuseDetectedAt: now,
          status: "reuse_detected" as const,
          updatedAt: now,
        };
        refreshTokensByHash.set(input.currentTokenHash, reused);
        return { refreshToken: reused, reuseDetected: true };
      }

      const rotated = {
        ...current,
        rotatedToTokenHash: input.nextTokenHash,
        status: "rotated" as const,
        updatedAt: now,
      };
      const next = makeRefreshToken({
        clientPublicId: current.clientPublicId,
        clerkOrgId: current.clerkOrgId,
        clerkUserId: current.clerkUserId,
        expiresAt: input.expiresAt,
        grantPublicId: current.grantPublicId,
        parentTokenHash: current.tokenHash,
        tokenHash: input.nextTokenHash,
      });
      refreshTokensByHash.set(current.tokenHash, rotated);
      refreshTokensByHash.set(next.tokenHash, next);
      return { refreshToken: next, reuseDetected: false };
    }
  );
  revokeMcpRefreshTokenByHashMock.mockImplementation(
    async (_db: Database, input: { tokenHash: string }) => {
      const token = refreshTokensByHash.get(input.tokenHash);
      if (!token || token.status !== "active") {
        return false;
      }
      refreshTokensByHash.set(input.tokenHash, {
        ...token,
        status: "revoked",
        updatedAt: now,
      });
      return true;
    }
  );
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("hosted MCP OAuth integration smoke", () => {
  it("connects a DCR client, calls a hosted tool, rotates refresh, and blocks revoked refresh", async () => {
    const { issueMcpAuthorizationCode } = await import(
      "../../../../api/app/src/mcp-oauth/authorization"
    );
    const { registerMcpOAuthClient } = await import(
      "../../../../api/app/src/mcp-oauth/clients"
    );
    const {
      createCodeChallenge,
      exchangeMcpAuthorizationCode,
      hashOpaqueToken,
      revokeMcpRefreshTokenSecret,
      rotateMcpRefreshTokenSecret,
    } = await import("../../../../api/app/src/mcp-oauth/tokens");
    const { verifyMcpAuthInfo } = await import("../auth/verify-token");
    const { createMcpContextFromAuthInfo } = await import("../context");
    const { executeHostedMcpTool } = await import("../tools/execute");

    const registeredClient = await registerMcpOAuthClient(
      db,
      {
        client_name: "Lightfield",
        client_uri: "https://lightfield.app",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
      },
      { now }
    );
    const codeVerifier = "verifier_test";
    const issuedCode = await issueMcpAuthorizationCode(db, {
      clientId: registeredClient.client_id,
      clerkOrgId: orgId,
      clerkUserId: userId,
      codeChallenge: createCodeChallenge(codeVerifier),
      codeChallengeMethod: "S256",
      now,
      redirectUri,
      resource,
      scope: "mcp:system:read mcp:signals:write",
    });
    const tokens = await exchangeMcpAuthorizationCode(db, {
      audience: resource,
      clientId: registeredClient.client_id,
      code: issuedCode.code,
      codeVerifier,
      issuer,
      jwtSecret,
      now,
      redirectUri,
    });

    expect(registeredClient).toMatchObject({
      client_name: "Lightfield",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
    });
    expect(createMcpOauthClientMock.mock.calls[0]?.[1]).not.toHaveProperty(
      "registrationAccessToken"
    );
    expect(createMcpAuthorizationCodeMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientPublicId: registeredClient.client_id,
        codeHash: hashOpaqueToken(issuedCode.code),
        scopes: ["mcp:system:read", "mcp:signals:write"],
      })
    );
    expect(consumeMcpAuthorizationCodeMock).toHaveBeenCalledWith(db, {
      codeHash: hashOpaqueToken(issuedCode.code),
    });
    expect(tokens).toMatchObject({
      expires_in: 900,
      grant_id: "mcp_grant_test",
      scope: "mcp:system:read mcp:signals:write",
      token_type: "Bearer",
    });

    const authInfo = await verifyMcpAuthInfo(
      new Request(resource),
      tokens.access_token
    );
    const context = createMcpContextFromAuthInfo(authInfo, {
      requestId: "req_e2e",
    });
    const toolDependencies = mcpToolDependencies();

    await expect(
      executeHostedMcpTool({
        context,
        contractPath: "signals.create",
        dependencies: toolDependencies,
        rawInput: { input: "  Ship remote MCP  " },
      })
    ).resolves.toEqual({
      id: signalId,
      status: "queued",
      visibilityScope: "user",
    });
    expect(toolDependencies.createSignalForActor).toHaveBeenCalledWith({
      actor: {
        clientId: registeredClient.client_id,
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId,
        userId,
      },
      input: "Ship remote MCP",
      scopes: ["mcp:signals:write"],
    });

    const rotated = await rotateMcpRefreshTokenSecret(db, {
      currentRefreshToken: tokens.refresh_token,
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      issuer,
      jwtSecret,
    });
    expect(rotated).toMatchObject({
      grant_id: "mcp_grant_test",
      reuseDetected: false,
    });
    expect(rotated.refresh_token).toMatch(/^mcp_refresh_/);
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token);

    await expect(
      revokeMcpRefreshTokenSecret(db, {
        refreshToken: rotated.refresh_token,
      })
    ).resolves.toBe(true);
    await expect(
      rotateMcpRefreshTokenSecret(db, {
        currentRefreshToken: rotated.refresh_token,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        issuer,
        jwtSecret,
      })
    ).rejects.toMatchObject({
      error: "invalid_grant",
      message: "Refresh token reuse detected.",
    });
    expect(revokeMcpOauthGrantMock).toHaveBeenCalledWith(db, {
      publicId: "mcp_grant_test",
    });
  });
});

function makeClient(
  overrides: Partial<McpOauthClientWithRedirectUris> = {}
): McpOauthClientWithRedirectUris {
  return {
    id: nextId++,
    clientName: "Lightfield",
    clientUri: "https://lightfield.app",
    contacts: null,
    logoUri: null,
    metadata: null,
    publicClientId: "mcp_client_test",
    redirectUris: [redirectUri],
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeAuthorizationCode(
  input: {
    clientPublicId: string;
    clerkOrgId: string;
    clerkUserId: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    codeHash: string;
    expiresAt: Date;
    redirectUri: string;
    resource: string;
    scopes: McpScope[];
  },
  overrides: Partial<McpOauthAuthorizationCode> = {}
): McpOauthAuthorizationCode {
  return {
    id: nextId++,
    clientPublicId: input.clientPublicId,
    clerkOrgId: input.clerkOrgId,
    clerkUserId: input.clerkUserId,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    codeHash: input.codeHash,
    consumedAt: null,
    expiresAt: input.expiresAt,
    redirectUri: input.redirectUri,
    resource: input.resource,
    resourceHash: "resource_hash",
    scopes: input.scopes,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeGrant(
  input: {
    clientPublicId: string;
    clerkOrgId: string;
    clerkUserId: string;
    resource: string;
    scopes: McpScope[];
  },
  overrides: Partial<McpOauthGrant> = {}
): McpOauthGrant {
  return {
    id: nextId++,
    publicId: "mcp_grant_test",
    clientPublicId: input.clientPublicId,
    clerkOrgId: input.clerkOrgId,
    clerkUserId: input.clerkUserId,
    metadata: null,
    resource: input.resource,
    resourceHash: "resource_hash",
    scopes: input.scopes,
    status: "active",
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRefreshToken(
  input: {
    clientPublicId: string;
    clerkOrgId: string;
    clerkUserId: string;
    expiresAt: Date;
    grantPublicId: string;
    parentTokenHash?: string | null;
    tokenHash: string;
  },
  overrides: Partial<McpOauthRefreshToken> = {}
): McpOauthRefreshToken {
  return {
    id: nextId++,
    clientPublicId: input.clientPublicId,
    clerkOrgId: input.clerkOrgId,
    clerkUserId: input.clerkUserId,
    expiresAt: input.expiresAt,
    grantPublicId: input.grantPublicId,
    parentTokenHash: input.parentTokenHash ?? null,
    reuseDetectedAt: null,
    rotatedToTokenHash: null,
    status: "active",
    tokenHash: input.tokenHash,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function mcpToolDependencies(): ExecuteHostedMcpToolDependencies {
  const createSignalForActor = vi.fn().mockResolvedValue({
    id: signalId,
    status: "queued",
    visibilityScope: "user",
  });
  return {
    assertOrgAccess: vi.fn().mockResolvedValue(undefined),
    callProviderRoutine: vi.fn().mockResolvedValue({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      status: "succeeded",
    }),
    createSignalForActor,
    findDecisions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    findProviderRoutines: vi.fn().mockResolvedValue({ routines: [] }),
    getDecision: vi.fn().mockResolvedValue(undefined),
    getSignalForActor: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => now),
    recordMcpAuditEvent: vi.fn().mockResolvedValue(undefined),
    version: "0.1.0-test",
  };
}
