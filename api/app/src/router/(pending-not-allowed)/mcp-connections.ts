import {
  getMcpOauthGrantByPublicId,
  listMcpOauthGrantConnectionsForOrg,
  revokeMcpOauthGrant,
} from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { toMcpConnectionDto } from "../../domain/mcp-connections";
import { orgAdminProcedure } from "../../trpc";

const revokeMcpConnectionInput = z.object({
  grantId: z.string().min(1),
});

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
