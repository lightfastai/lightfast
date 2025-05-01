import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { User } from "@vendor/db/lightfast/schema";

import { protectedProcedure, publicProcedure } from "../../trpc";

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
      console.log("Creating user", input);
      try {
        const [user] = await ctx.db
          .insert(User)
          .values({ clerkId: input.clerkId, emailAddress: input.emailAddress })
          .returning();

        if (!user) {
          console.error("User not created", input);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        console.log("User created", user);
        return user;
      } catch (error) {
        console.error("Error creating user", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error creating user",
        });
      }
    }),
} satisfies TRPCRouterRecord;
