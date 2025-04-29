import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq } from "@vendor/db";
import { User } from "@vendor/db/lightfast/schema";
import { protectedProcedure, publicProcedure } from "@vendor/trpc";

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
  create: publicProcedure
    .input(
      z.object({
        clerkId: z.string(),
        emailAddress: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .insert(User)
        .values({ clerkId: input.clerkId, emailAddress: input.emailAddress })
        .returning();

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return user;
    }),
} satisfies TRPCRouterRecord;
