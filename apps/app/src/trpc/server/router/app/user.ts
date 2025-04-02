import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { eq } from "@vendor/db";
import { User } from "@vendor/db/schema";
import { protectedProcedure } from "@vendor/trpc";

export const appUserRouter = {
  get: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select()
      .from(User)
      .where(eq(User.clerkId, ctx.session.user.clerkId))
      .limit(1);

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user;
  }),
} satisfies TRPCRouterRecord;
