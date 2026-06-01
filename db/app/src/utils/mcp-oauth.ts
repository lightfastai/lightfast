import type { McpScope } from "@repo/api-contract";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";

import type { Database } from "../client";
import {
  createMcpOauthClientId,
  createMcpOauthGrantId,
  hashMcpOauthResource,
  type McpAuditOutcome,
  type McpCodeChallengeMethod,
  type McpOauthAuthorizationCode,
  type McpOauthClient,
  type McpOauthGrant,
  type McpOauthRefreshToken,
  mcpAuditEvents,
  mcpOauthAuthorizationCodes,
  mcpOauthClientRedirectUris,
  mcpOauthClients,
  mcpOauthGrants,
  mcpOauthRefreshTokens,
  mcpOauthRegistrationTokens,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";

const REDACTED_VALUE = "[redacted]";

export interface McpOauthClientWithRedirectUris extends McpOauthClient {
  redirectUris: string[];
}

export interface McpRefreshTokenStatusSummary {
  active: number;
  reuseDetected: number;
  revoked: number;
  rotated: number;
}

export interface McpOauthGrantConnection {
  client: Pick<
    McpOauthClient,
    | "clientName"
    | "clientUri"
    | "logoUri"
    | "metadata"
    | "publicClientId"
    | "status"
  > | null;
  grant: McpOauthGrant;
  redirectUris: string[];
  refreshTokenStatusSummary: McpRefreshTokenStatusSummary;
}

export interface CreateMcpOauthClientInput {
  clientName: string;
  clientUri?: string | null;
  contacts?: string[] | null;
  logoUri?: string | null;
  metadata?: Record<string, unknown> | null;
  publicClientId?: string;
  redirectUris: string[];
  registrationAccessTokenExpiresAt?: Date | null;
  registrationAccessTokenHash?: string | null;
}

export async function createMcpOauthClient(
  db: Database,
  input: CreateMcpOauthClientInput
): Promise<McpOauthClientWithRedirectUris> {
  const publicClientId = input.publicClientId ?? createMcpOauthClientId();
  return await db.transaction(async (tx) => {
    await tx.insert(mcpOauthClients).values({
      publicClientId,
      clientName: input.clientName,
      clientUri: input.clientUri ?? null,
      contacts: input.contacts ?? null,
      logoUri: input.logoUri ?? null,
      metadata: input.metadata ?? null,
      status: "active",
    });

    if (input.redirectUris.length > 0) {
      await tx.insert(mcpOauthClientRedirectUris).values(
        input.redirectUris.map((redirectUri) => ({
          clientPublicId: publicClientId,
          redirectUri,
        }))
      );
    }

    if (input.registrationAccessTokenHash) {
      await tx.insert(mcpOauthRegistrationTokens).values({
        clientPublicId: publicClientId,
        expiresAt: input.registrationAccessTokenExpiresAt ?? null,
        status: "active",
        tokenHash: input.registrationAccessTokenHash,
      });
    }

    const client = await getMcpOauthClientByClientId(tx, { publicClientId });
    if (!client) {
      throw new Error(`Failed to create MCP OAuth client ${publicClientId}`);
    }
    return client;
  });
}

export async function getMcpOauthClientByClientId(
  db: Database,
  input: { publicClientId: string }
): Promise<McpOauthClientWithRedirectUris | undefined> {
  const [client] = await db
    .select()
    .from(mcpOauthClients)
    .where(
      and(
        eq(mcpOauthClients.publicClientId, input.publicClientId),
        eq(mcpOauthClients.status, "active")
      )
    )
    .limit(1);
  if (!client) {
    return;
  }

  const redirectRows = await db
    .select({ redirectUri: mcpOauthClientRedirectUris.redirectUri })
    .from(mcpOauthClientRedirectUris)
    .where(eq(mcpOauthClientRedirectUris.clientPublicId, input.publicClientId))
    .orderBy(asc(mcpOauthClientRedirectUris.id));

  return {
    ...client,
    redirectUris: redirectRows.map((row) => row.redirectUri),
  };
}

export async function getMcpOauthClientByRegistrationTokenHash(
  db: Database,
  input: { now?: Date; tokenHash: string }
): Promise<McpOauthClientWithRedirectUris | undefined> {
  const [token] = await db
    .select()
    .from(mcpOauthRegistrationTokens)
    .where(
      and(
        eq(mcpOauthRegistrationTokens.tokenHash, input.tokenHash),
        eq(mcpOauthRegistrationTokens.status, "active")
      )
    )
    .limit(1);
  if (!token) {
    return;
  }
  if (token.expiresAt && token.expiresAt <= (input.now ?? new Date())) {
    return;
  }
  return await getMcpOauthClientByClientId(db, {
    publicClientId: token.clientPublicId,
  });
}

export interface CreateMcpOauthGrantInput {
  clerkOrgId: string;
  clerkUserId: string;
  clientPublicId: string;
  metadata?: Record<string, unknown> | null;
  publicId?: string;
  resource: string;
  scopes: McpScope[];
}

export async function createMcpOauthGrant(
  db: Database,
  input: CreateMcpOauthGrantInput
): Promise<McpOauthGrant> {
  const publicId = input.publicId ?? createMcpOauthGrantId();
  await db.insert(mcpOauthGrants).values({
    publicId,
    clientPublicId: input.clientPublicId,
    clerkOrgId: input.clerkOrgId,
    clerkUserId: input.clerkUserId,
    metadata: input.metadata ?? null,
    resource: input.resource,
    resourceHash: hashMcpOauthResource(input.resource),
    scopes: input.scopes,
    status: "active",
  });

  const grant = await getMcpOauthGrantByPublicId(db, { publicId });
  if (!grant) {
    throw new Error(`Failed to create MCP OAuth grant ${publicId}`);
  }
  return grant;
}

export async function getMcpOauthGrantByPublicId(
  db: Database,
  input: { publicId: string }
): Promise<McpOauthGrant | undefined> {
  const [grant] = await db
    .select()
    .from(mcpOauthGrants)
    .where(eq(mcpOauthGrants.publicId, input.publicId))
    .limit(1);
  return grant;
}

export async function listMcpOauthGrantConnectionsForUser(
  db: Database,
  input: { clerkUserId: string }
): Promise<McpOauthGrantConnection[]> {
  const grants = await db
    .select()
    .from(mcpOauthGrants)
    .where(eq(mcpOauthGrants.clerkUserId, input.clerkUserId))
    .orderBy(desc(mcpOauthGrants.createdAt), desc(mcpOauthGrants.id));

  return hydrateMcpOauthGrantConnections(db, grants);
}

export async function listMcpOauthGrantConnectionsForOrg(
  db: Database,
  input: { clerkOrgId: string }
): Promise<McpOauthGrantConnection[]> {
  const grants = await db
    .select()
    .from(mcpOauthGrants)
    .where(eq(mcpOauthGrants.clerkOrgId, input.clerkOrgId))
    .orderBy(desc(mcpOauthGrants.createdAt), desc(mcpOauthGrants.id));

  return hydrateMcpOauthGrantConnections(db, grants);
}

async function hydrateMcpOauthGrantConnections(
  db: Database,
  grants: McpOauthGrant[]
): Promise<McpOauthGrantConnection[]> {
  if (grants.length === 0) {
    return [];
  }

  const clientIds = [...new Set(grants.map((grant) => grant.clientPublicId))];
  const grantIds = grants.map((grant) => grant.publicId);

  const [clients, redirectRows, refreshTokens] = await Promise.all([
    db
      .select({
        clientName: mcpOauthClients.clientName,
        clientUri: mcpOauthClients.clientUri,
        logoUri: mcpOauthClients.logoUri,
        metadata: mcpOauthClients.metadata,
        publicClientId: mcpOauthClients.publicClientId,
        status: mcpOauthClients.status,
      })
      .from(mcpOauthClients)
      .where(inArray(mcpOauthClients.publicClientId, clientIds)),
    db
      .select({
        clientPublicId: mcpOauthClientRedirectUris.clientPublicId,
        redirectUri: mcpOauthClientRedirectUris.redirectUri,
      })
      .from(mcpOauthClientRedirectUris)
      .where(inArray(mcpOauthClientRedirectUris.clientPublicId, clientIds))
      .orderBy(asc(mcpOauthClientRedirectUris.id)),
    db
      .select({
        grantPublicId: mcpOauthRefreshTokens.grantPublicId,
        status: mcpOauthRefreshTokens.status,
      })
      .from(mcpOauthRefreshTokens)
      .where(inArray(mcpOauthRefreshTokens.grantPublicId, grantIds)),
  ]);

  const clientsById = new Map(
    clients.map((client) => [client.publicClientId, client])
  );
  const redirectUrisByClientId = new Map<string, string[]>();
  for (const row of redirectRows) {
    const uris = redirectUrisByClientId.get(row.clientPublicId) ?? [];
    uris.push(row.redirectUri);
    redirectUrisByClientId.set(row.clientPublicId, uris);
  }

  const tokenSummaryByGrantId = new Map<string, McpRefreshTokenStatusSummary>();
  for (const row of refreshTokens) {
    const summary =
      tokenSummaryByGrantId.get(row.grantPublicId) ??
      emptyRefreshTokenStatusSummary();
    switch (row.status) {
      case "active":
        summary.active += 1;
        break;
      case "reuse_detected":
        summary.reuseDetected += 1;
        break;
      case "revoked":
        summary.revoked += 1;
        break;
      case "rotated":
        summary.rotated += 1;
        break;
      default:
        break;
    }
    tokenSummaryByGrantId.set(row.grantPublicId, summary);
  }

  return grants.map((grant) => ({
    client: clientsById.get(grant.clientPublicId) ?? null,
    grant,
    redirectUris: redirectUrisByClientId.get(grant.clientPublicId) ?? [],
    refreshTokenStatusSummary:
      tokenSummaryByGrantId.get(grant.publicId) ??
      emptyRefreshTokenStatusSummary(),
  }));
}

function emptyRefreshTokenStatusSummary(): McpRefreshTokenStatusSummary {
  return {
    active: 0,
    reuseDetected: 0,
    revoked: 0,
    rotated: 0,
  };
}

export async function getActiveMcpOauthGrant(
  db: Database,
  input: {
    clientPublicId: string;
    clerkOrgId: string;
    clerkUserId: string;
    resource: string;
  }
): Promise<McpOauthGrant | undefined> {
  const [grant] = await db
    .select()
    .from(mcpOauthGrants)
    .where(
      and(
        eq(mcpOauthGrants.clientPublicId, input.clientPublicId),
        eq(mcpOauthGrants.clerkOrgId, input.clerkOrgId),
        eq(mcpOauthGrants.clerkUserId, input.clerkUserId),
        eq(mcpOauthGrants.resourceHash, hashMcpOauthResource(input.resource)),
        eq(mcpOauthGrants.resource, input.resource),
        eq(mcpOauthGrants.status, "active")
      )
    )
    .limit(1);
  return grant;
}

export async function revokeMcpOauthGrant(
  db: Database,
  input: { publicId: string; revokedAt?: Date }
): Promise<boolean> {
  const result = await db
    .update(mcpOauthGrants)
    .set({
      revokedAt: input.revokedAt ?? new Date(),
      status: "revoked",
    })
    .where(
      and(
        eq(mcpOauthGrants.publicId, input.publicId),
        eq(mcpOauthGrants.status, "active")
      )
    );
  return getRowsAffected(result) > 0;
}

export interface CreateMcpAuthorizationCodeInput {
  clerkOrgId: string;
  clerkUserId: string;
  clientPublicId: string;
  codeChallenge: string;
  codeChallengeMethod: McpCodeChallengeMethod;
  codeHash: string;
  expiresAt: Date;
  redirectUri: string;
  resource: string;
  scopes: McpScope[];
}

export async function createMcpAuthorizationCode(
  db: Database,
  input: CreateMcpAuthorizationCodeInput
): Promise<McpOauthAuthorizationCode> {
  await db.insert(mcpOauthAuthorizationCodes).values({
    clientPublicId: input.clientPublicId,
    clerkOrgId: input.clerkOrgId,
    clerkUserId: input.clerkUserId,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    codeHash: input.codeHash,
    expiresAt: input.expiresAt,
    redirectUri: input.redirectUri,
    resource: input.resource,
    resourceHash: hashMcpOauthResource(input.resource),
    scopes: input.scopes,
  });

  const code = await getMcpAuthorizationCodeByHash(db, {
    codeHash: input.codeHash,
  });
  if (!code) {
    throw new Error("Failed to create MCP OAuth authorization code.");
  }
  return code;
}

export async function consumeMcpAuthorizationCode(
  db: Database,
  input: { codeHash: string; now?: Date }
): Promise<McpOauthAuthorizationCode | undefined> {
  const code = await getMcpAuthorizationCodeByHash(db, input);
  const now = input.now ?? new Date();
  if (!code || code.consumedAt || code.expiresAt <= now) {
    return;
  }

  const result = await db
    .update(mcpOauthAuthorizationCodes)
    .set({ consumedAt: now })
    .where(
      and(
        eq(mcpOauthAuthorizationCodes.codeHash, input.codeHash),
        isNull(mcpOauthAuthorizationCodes.consumedAt)
      )
    );
  if (getRowsAffected(result) === 0) {
    return;
  }
  return { ...code, consumedAt: now };
}

async function getMcpAuthorizationCodeByHash(
  db: Database,
  input: { codeHash: string }
): Promise<McpOauthAuthorizationCode | undefined> {
  const [code] = await db
    .select()
    .from(mcpOauthAuthorizationCodes)
    .where(eq(mcpOauthAuthorizationCodes.codeHash, input.codeHash))
    .limit(1);
  return code;
}

export interface CreateMcpRefreshTokenInput {
  clerkOrgId: string;
  clerkUserId: string;
  clientPublicId: string;
  expiresAt: Date;
  grantPublicId: string;
  parentTokenHash?: string | null;
  tokenHash: string;
}

export async function createMcpRefreshToken(
  db: Database,
  input: CreateMcpRefreshTokenInput
): Promise<McpOauthRefreshToken> {
  await db.insert(mcpOauthRefreshTokens).values({
    clientPublicId: input.clientPublicId,
    clerkOrgId: input.clerkOrgId,
    clerkUserId: input.clerkUserId,
    expiresAt: input.expiresAt,
    grantPublicId: input.grantPublicId,
    parentTokenHash: input.parentTokenHash ?? null,
    status: "active",
    tokenHash: input.tokenHash,
  });

  const token = await getMcpRefreshTokenByHash(db, {
    tokenHash: input.tokenHash,
  });
  if (!token) {
    throw new Error("Failed to create MCP OAuth refresh token.");
  }
  return token;
}

export interface RotateMcpRefreshTokenInput {
  currentTokenHash: string;
  expiresAt: Date;
  nextTokenHash: string;
  now?: Date;
}

export interface RotateMcpRefreshTokenResult {
  refreshToken: McpOauthRefreshToken | undefined;
  reuseDetected: boolean;
}

export async function rotateMcpRefreshToken(
  db: Database,
  input: RotateMcpRefreshTokenInput
): Promise<RotateMcpRefreshTokenResult> {
  return await db.transaction(async (tx) => {
    const now = input.now ?? new Date();
    const current = await getMcpRefreshTokenByHash(tx, {
      tokenHash: input.currentTokenHash,
    });
    if (!current) {
      return { refreshToken: undefined, reuseDetected: false };
    }

    if (current.status === "active" && current.expiresAt <= now) {
      return { refreshToken: undefined, reuseDetected: false };
    }

    if (current.status !== "active") {
      return await markMcpRefreshTokenReuseDetected(tx, current, now);
    }

    const rotateResult = await tx
      .update(mcpOauthRefreshTokens)
      .set({
        rotatedToTokenHash: input.nextTokenHash,
        status: "rotated",
      })
      .where(
        and(
          eq(mcpOauthRefreshTokens.tokenHash, input.currentTokenHash),
          eq(mcpOauthRefreshTokens.status, "active"),
          gt(mcpOauthRefreshTokens.expiresAt, now)
        )
      );
    if (getRowsAffected(rotateResult) === 0) {
      const latest = await getMcpRefreshTokenByHash(tx, {
        tokenHash: input.currentTokenHash,
      });
      if (!latest || (latest.status === "active" && latest.expiresAt <= now)) {
        return { refreshToken: undefined, reuseDetected: false };
      }
      if (latest.status !== "active") {
        return await markMcpRefreshTokenReuseDetected(tx, latest, now);
      }
      return { refreshToken: undefined, reuseDetected: false };
    }

    await tx.insert(mcpOauthRefreshTokens).values({
      clientPublicId: current.clientPublicId,
      clerkOrgId: current.clerkOrgId,
      clerkUserId: current.clerkUserId,
      expiresAt: input.expiresAt,
      grantPublicId: current.grantPublicId,
      parentTokenHash: current.tokenHash,
      status: "active",
      tokenHash: input.nextTokenHash,
    });

    const next = await getMcpRefreshTokenByHash(tx, {
      tokenHash: input.nextTokenHash,
    });
    if (!next) {
      throw new Error("Failed to rotate MCP OAuth refresh token.");
    }
    return { refreshToken: next, reuseDetected: false };
  });
}

async function markMcpRefreshTokenReuseDetected(
  db: Database,
  token: McpOauthRefreshToken,
  reuseDetectedAt: Date
): Promise<RotateMcpRefreshTokenResult> {
  await db
    .update(mcpOauthRefreshTokens)
    .set({
      reuseDetectedAt,
      status: "reuse_detected",
    })
    .where(eq(mcpOauthRefreshTokens.tokenHash, token.tokenHash));
  return {
    refreshToken: {
      ...token,
      reuseDetectedAt,
      status: "reuse_detected",
    },
    reuseDetected: true,
  };
}

async function getMcpRefreshTokenByHash(
  db: Database,
  input: { tokenHash: string }
): Promise<McpOauthRefreshToken | undefined> {
  const [token] = await db
    .select()
    .from(mcpOauthRefreshTokens)
    .where(eq(mcpOauthRefreshTokens.tokenHash, input.tokenHash))
    .limit(1);
  return token;
}

export async function revokeMcpRefreshTokenByHash(
  db: Database,
  input: { tokenHash: string }
): Promise<boolean> {
  const result = await db
    .update(mcpOauthRefreshTokens)
    .set({ status: "revoked" })
    .where(
      and(
        eq(mcpOauthRefreshTokens.tokenHash, input.tokenHash),
        eq(mcpOauthRefreshTokens.status, "active")
      )
    );
  return getRowsAffected(result) > 0;
}

export interface RecordMcpAuditEventInput {
  clerkOrgId?: string | null;
  clerkUserId?: string | null;
  clientPublicId?: string | null;
  eventName: string;
  grantPublicId?: string | null;
  metadata?: Record<string, unknown> | null;
  outcome: McpAuditOutcome;
}

export async function recordMcpAuditEvent(
  db: Database,
  input: RecordMcpAuditEventInput
): Promise<void> {
  await db.insert(mcpAuditEvents).values({
    clientPublicId: input.clientPublicId ?? null,
    clerkOrgId: input.clerkOrgId ?? null,
    clerkUserId: input.clerkUserId ?? null,
    eventName: input.eventName,
    grantPublicId: input.grantPublicId ?? null,
    metadata: redactAuditMetadata(input.metadata ?? null),
    outcome: input.outcome,
  });
}

export function redactAuditMetadata(
  metadata: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }
  return redactValue(metadata) as Record<string, unknown>;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, childValue]) => [
      key,
      isSensitiveAuditKey(key) ? REDACTED_VALUE : redactValue(childValue),
    ])
  );
}

function isSensitiveAuditKey(key: string): boolean {
  const normalized = key.replace(/[-_]/g, "").toLowerCase();
  return (
    normalized === "code" ||
    normalized === "authorizationcode" ||
    normalized === "codeverifier" ||
    normalized.includes("secret") ||
    normalized.includes("token")
  );
}
