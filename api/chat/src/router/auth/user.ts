import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { currentUser } from "@clerk/nextjs/server";

export const userRouter = {
  /**
   * Get current user info
   */
  getUser: protectedProcedure
    .query(async ({ ctx }) => {
      // Fetch full user data from Clerk
      const user = await currentUser();
      
      return {
        userId: ctx.session.userId,
        email: user?.emailAddresses[0]?.emailAddress ?? null,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        username: user?.username ?? null,
      };
    }),
} satisfies TRPCRouterRecord;