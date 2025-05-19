import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { User } from "@vendor/db/lightfast/schema";

import { serverProcedure } from "../../trpc";

export const userRouter = {
  create: serverProcedure
    .input(
      z.object({
        email: z.string().email("Please enter a valid email address."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .insert(User)
        .values({ email: input.email })
        .returning();
      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return user;
    }),
} satisfies TRPCRouterRecord;
