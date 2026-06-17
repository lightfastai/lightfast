import {
  type Database,
  getMcpOauthGrantByPublicId,
  listMcpOauthGrantConnectionsForUser,
  type McpOauthGrant,
  type McpOauthGrantConnection,
  revokeMcpOauthGrant,
} from "@db/app";
import { z } from "zod";

import { defineCommand } from "../command";
import { NotFoundError } from "../errors";
import { requireClerkUserActor } from "../gates";

interface McpConnectionDto {
  clientId: string;
  clientName: string;
  clientPolicyUri: string | null;
  clientUri: string | null;
  clientVerificationStatus: "unverified" | "verified";
  connectedUserId: string;
  createdAt: string;
  grantId: string;
  lastUsedAt: string | null;
  logoUri: string | null;
  redirectUris: string[];
  refreshTokenStatusSummary: McpOauthGrantConnection["refreshTokenStatusSummary"];
  resource: string;
  revokedAt: string | null;
  scopes: string[];
  status: McpOauthGrant["status"];
}

interface McpConnectionCommandDeps {
  db: Database;
  getMcpOauthGrantByPublicId: typeof getMcpOauthGrantByPublicId;
  listMcpOauthGrantConnectionsForUser: typeof listMcpOauthGrantConnectionsForUser;
  revokeMcpOauthGrant: typeof revokeMcpOauthGrant;
}

export function createDefaultMcpConnectionCommandDeps(input: {
  db: Database;
  getMcpOauthGrantByPublicId?: typeof getMcpOauthGrantByPublicId;
  listMcpOauthGrantConnectionsForUser?: typeof listMcpOauthGrantConnectionsForUser;
  revokeMcpOauthGrant?: typeof revokeMcpOauthGrant;
}): McpConnectionCommandDeps {
  return {
    db: input.db,
    getMcpOauthGrantByPublicId:
      input.getMcpOauthGrantByPublicId ?? getMcpOauthGrantByPublicId,
    listMcpOauthGrantConnectionsForUser:
      input.listMcpOauthGrantConnectionsForUser ??
      listMcpOauthGrantConnectionsForUser,
    revokeMcpOauthGrant: input.revokeMcpOauthGrant ?? revokeMcpOauthGrant,
  };
}

const mcpConnectionInput = z.object({}).strict();

const mcpConnectionDtoOutput = z.object({
  clientId: z.string(),
  clientName: z.string(),
  clientPolicyUri: z.string().nullable(),
  clientUri: z.string().nullable(),
  clientVerificationStatus: z.enum(["unverified", "verified"]),
  connectedUserId: z.string(),
  createdAt: z.string(),
  grantId: z.string(),
  lastUsedAt: z.string().nullable(),
  logoUri: z.string().nullable(),
  redirectUris: z.array(z.string()),
  refreshTokenStatusSummary: z.object({
    active: z.number(),
    reuseDetected: z.number(),
    revoked: z.number(),
    rotated: z.number(),
  }),
  resource: z.string(),
  revokedAt: z.string().nullable(),
  scopes: z.array(z.string()),
  status: z.enum(["active", "revoked"]),
});

const revokeMcpConnectionInput = z.object({
  grantId: z.string().min(1),
});

const successOutput = z.object({ success: z.literal(true) });

export const listAccountMcpConnectionsCommand = defineCommand<
  "mcpConnections.listForAccount",
  typeof mcpConnectionInput,
  z.ZodArray<typeof mcpConnectionDtoOutput>,
  McpConnectionCommandDeps
>({
  name: "mcpConnections.listForAccount",
  input: mcpConnectionInput,
  output: z.array(mcpConnectionDtoOutput),
  run: async ({ ctx, deps }) => {
    const actor = requireClerkUserActor(ctx);
    const connections = await deps.listMcpOauthGrantConnectionsForUser(
      deps.db,
      { clerkUserId: actor.userId }
    );
    return connections.map(toMcpConnectionDto);
  },
});

export const revokeAccountMcpConnectionCommand = defineCommand<
  "mcpConnections.revokeForAccount",
  typeof revokeMcpConnectionInput,
  typeof successOutput,
  McpConnectionCommandDeps
>({
  name: "mcpConnections.revokeForAccount",
  input: revokeMcpConnectionInput,
  output: successOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkUserActor(ctx);
    const grant = await deps.getMcpOauthGrantByPublicId(deps.db, {
      publicId: input.grantId,
    });

    if (!grant || grant.clerkUserId !== actor.userId) {
      throw new NotFoundError(
        "MCP_CONNECTION_NOT_FOUND",
        "MCP connection not found."
      );
    }

    if (grant.status === "active") {
      await deps.revokeMcpOauthGrant(deps.db, { publicId: input.grantId });
    }

    return { success: true };
  },
});

export function toMcpConnectionDto(
  connection: McpOauthGrantConnection
): McpConnectionDto {
  const client = connection.client;
  return {
    clientId: connection.grant.clientPublicId,
    clientName: client?.clientName ?? "Unknown MCP client",
    clientPolicyUri: client
      ? stringMetadata(client.metadata, "policyUri")
      : null,
    clientUri: client?.clientUri ?? null,
    clientVerificationStatus:
      client?.status === "active" ? "verified" : "unverified",
    connectedUserId: connection.grant.clerkUserId,
    createdAt: connection.grant.createdAt.toISOString(),
    grantId: connection.grant.publicId,
    lastUsedAt: connection.grant.lastUsedAt?.toISOString() ?? null,
    logoUri: client?.logoUri ?? null,
    redirectUris: connection.redirectUris,
    refreshTokenStatusSummary: connection.refreshTokenStatusSummary,
    resource: connection.grant.resource,
    revokedAt: connection.grant.revokedAt?.toISOString() ?? null,
    scopes: connection.grant.scopes,
    status: connection.grant.status,
  };
}

function stringMetadata(
  metadata: Record<string, unknown> | null,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
