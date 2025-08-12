import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";

export const userRouter = {
  /**
   * Get current user info
   */
  getUser: protectedProcedure
    .query(async ({ ctx }) => {
      // Return minimal user info for now
      return {
        userId: ctx.session.userId,
        email: ctx.session.sessionClaims?.email || null,
      };
    }),
} satisfies TRPCRouterRecord;