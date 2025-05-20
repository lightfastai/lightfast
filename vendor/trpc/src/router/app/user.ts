import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq } from "@vendor/db";
import { User } from "@vendor/db/lightfast/schema";

import { serverProcedure } from "../../trpc";

// Define a constant for the PostgreSQL unique violation error code
const POSTGRES_UNIQUE_VIOLATION_ERROR_CODE = "23505";

export const userRouter = {
  create: serverProcedure
    .input(
      z.object({
        email: z.string().email("Please enter a valid email address."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lowercaseEmail = input.email.toLowerCase();

      const [existingUser] = await ctx.db
        .select()
        .from(User)
        .where(eq(User.email, lowercaseEmail));

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email address already exists.",
        });
      }

      try {
        const [user] = await ctx.db
          .insert(User)
          .values({ email: lowercaseEmail })
          .returning();

        if (!user) {
          // This case should ideally not be reached if insert succeeds or throws.
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "User creation failed unexpectedly after insert.",
          });
        }
        return user;
      } catch (dbError: unknown) {
        let isConflict = false;

        // Check if dbError is an object and has a 'code' property
        if (
          dbError &&
          typeof dbError === "object" &&
          "code" in dbError &&
          (dbError as { code: unknown }).code ===
            POSTGRES_UNIQUE_VIOLATION_ERROR_CODE
        ) {
          isConflict = true;
        } else if (
          // Fallback check for message, in case 'code' is not present or error is structured differently
          dbError &&
          typeof dbError === "object" &&
          "message" in dbError &&
          typeof (dbError as { message: unknown }).message === "string" &&
          (dbError as { message: string }).message.includes("unique constraint")
        ) {
          isConflict = true;
        }

        if (isConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A user with this email address already exists (database constraint).",
          });
        }

        // Log the original error for debugging purposes if it wasn't a recognized conflict
        console.error("Database error during user creation:", dbError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred during user creation.",
        });
      }
    }),
} satisfies TRPCRouterRecord;
