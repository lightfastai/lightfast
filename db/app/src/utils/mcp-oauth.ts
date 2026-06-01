import type { McpScope } from "@repo/api-contract";
import { and, asc, eq, isNull } from "drizzle-orm";

import type { Database } from "../client";
import {
  createMcpOauthClientId,
  createMcpOauthGrantId,
  hashMcpOauthResource,
  type McpAuditEvent,
  type McpAuditOutcome,
  mcpAuditEvents,
  type McpCodeChallengeMethod,
  type McpOauthAuthorizationCode,
  mcpOauthAuthorizationCodes,
  type McpOauthClient,
  mcpOauthClientRedirectUris,
  mcpOauthClients,
  type McpOauthGrant,
  mcpOauthGrants,
  mcpOauthRefreshTokens,
  mcpOauthRegistrationTokens,
  type McpOauthRefreshToken,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";

const REDACTED_VALUE = "[redacted]";

export interface McpOauthClientWithRedirectUris extends McpOauthClient {
  redirectUris: string[];
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

export interface CreateMcpOauthGrantInput {
  clientPublicId: string;
  clerkOrgId: string;
  clerkUserId: string;
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
  clientPublicId: string;
  clerkOrgId: string;
  clerkUserId: string;
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
  clientPublicId: string;
  clerkOrgId: string;
  clerkUserId: string;
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
    const current = await getMcpRefreshTokenByHash(tx, {
      tokenHash: input.currentTokenHash,
    });
    if (!current) {
      return { refreshToken: undefined, reuseDetected: true };
    }

    if (current.status !== "active") {
      const reuseDetectedAt = input.now ?? new Date();
      await tx
        .update(mcpOauthRefreshTokens)
        .set({
          reuseDetectedAt,
          status: "reuse_detected",
        })
        .where(eq(mcpOauthRefreshTokens.tokenHash, input.currentTokenHash));
      return {
        refreshToken: {
          ...current,
          reuseDetectedAt,
          status: "reuse_detected",
        },
        reuseDetected: true,
      };
    }

    await tx
      .update(mcpOauthRefreshTokens)
      .set({
        rotatedToTokenHash: input.nextTokenHash,
        status: "rotated",
      })
      .where(eq(mcpOauthRefreshTokens.tokenHash, input.currentTokenHash));

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

export interface RecordMcpAuditEventInput {
  clientPublicId?: string | null;
  clerkOrgId?: string | null;
  clerkUserId?: string | null;
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
