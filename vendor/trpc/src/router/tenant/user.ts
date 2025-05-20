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
        // email: z.string().email("Please enter a valid email address."),
        email: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      console.log(`Fetching user by email: ${input.email}`);
      const lowercaseEmail = input.email.toLowerCase();
      try {
        const [user] = await ctx.db
          .select()
          .from(User)
          .where(eq(User.email, lowercaseEmail));
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return user;
      } catch (error) {
        // Log the error for server-side debugging
        console.error(
          `Database error while trying to fetch user by email ${lowercaseEmail}:`,
          error,
        );
        // If it's already a TRPCError that we threw (e.g., NOT_FOUND), rethrow it
        if (error instanceof TRPCError) {
          throw error;
        }
        // For other types of errors, throw a generic internal server error
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred while retrieving user data.",
          // Optionally, you can include the original error as a cause in development
          // cause: process.env.NODE_ENV === 'development' ? error : undefined,
        });
      }
    }),
} satisfies TRPCRouterRecord;
