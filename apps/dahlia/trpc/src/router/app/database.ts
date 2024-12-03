import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { eq } from "@vendor/db";
import { Database } from "@vendor/db/app/schema";
import { protectedProcedure } from "@vendor/trpc";

export const appDatabaseRouter = {
  get: protectedProcedure.query(async ({ ctx }) => {
    const [database] = await ctx.db
      .select()
      .from(Database)
      .where(eq(Database.userId, ctx.session.user.clerkId))
      .limit(1);

    if (!database) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Database not found",
      });
    }

    return database;
  }),
} satisfies TRPCRouterRecord;
