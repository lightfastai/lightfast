import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq } from "@vendor/db";
import { User } from "@vendor/db/lightfast/schema";

import { publicProcedure } from "../../trpc";

export const userRouter = {
  getByEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email("Please enter a valid email address."),
      }),
    )
    .query(async ({ ctx, input }) => {
      const lowercaseEmail = input.email.toLowerCase();
      const [user] = await ctx.db
        .select()
        .from(User)
        .where(eq(User.email, lowercaseEmail));
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return user;
    }),
} satisfies TRPCRouterRecord;
