import {
  getMcpOauthGrantByPublicId,
  listMcpOauthGrantConnectionsForOrg,
  listMcpOauthGrantConnectionsForUser,
  type McpOauthGrant,
  type McpOauthGrantConnection,
  revokeMcpOauthGrant,
} from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { orgAdminProcedure, viewerProcedure } from "../../trpc";

const revokeMcpConnectionInput = z.object({
  grantId: z.string().min(1),
});

export interface McpConnectionDto {
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

export const accountMcpConnectionsRouter = {
  list: viewerProcedure.query(async ({ ctx }) => {
    const connections = await listMcpOauthGrantConnectionsForUser(ctx.db, {
      clerkUserId: ctx.auth.identity.userId,
    });
    return connections.map(toMcpConnectionDto);
  }),

  revoke: viewerProcedure
    .input(revokeMcpConnectionInput)
    .mutation(async ({ ctx, input }) => {
      const grant = await getMcpOauthGrantByPublicId(ctx.db, {
        publicId: input.grantId,
      });
      if (!grant || grant.clerkUserId !== ctx.auth.identity.userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP connection not found.",
        });
      }

      if (grant.status === "active") {
        await revokeMcpOauthGrant(ctx.db, { publicId: input.grantId });
      }
      return { success: true };
    }),
} satisfies TRPCRouterRecord;

export const orgMcpConnectionsRouter = {
  list: orgAdminProcedure.query(async ({ ctx }) => {
    const connections = await listMcpOauthGrantConnectionsForOrg(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
    });
    return connections.map(toMcpConnectionDto);
  }),

  revoke: orgAdminProcedure
    .input(revokeMcpConnectionInput)
    .mutation(async ({ ctx, input }) => {
      const grant = await getMcpOauthGrantByPublicId(ctx.db, {
        publicId: input.grantId,
      });
      if (!grant || grant.clerkOrgId !== ctx.auth.identity.orgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP connection not found.",
        });
      }

      if (grant.status === "active") {
        await revokeMcpOauthGrant(ctx.db, { publicId: input.grantId });
      }
      return { success: true };
    }),
} satisfies TRPCRouterRecord;

function toMcpConnectionDto(
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
