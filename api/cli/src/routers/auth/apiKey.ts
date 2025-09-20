import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import {
  publicProcedure,
  TRPCError,
} from "../../trpc";

// Import validation functions from cloud API to avoid duplication
import { validateApiKey } from "@api/cloud";

// Constants
const API_KEY_PREFIX = "lf_";

export const apiKeyRouter = {
  /**
   * Validate an API key (for CLI authentication)
   */
  validate: publicProcedure
    .input(
      z.object({
        key: z
          .string()
          .min(1, "API key is required")
          .refine(
            (val) => val.startsWith(API_KEY_PREFIX),
            `API key must start with ${API_KEY_PREFIX}`,
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { key } = input;

      try {
        // Use the validation function from cloud API
        const validKey = await validateApiKey(key, db);

        if (!validKey) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid API key",
          });
        }

        return {
          valid: true,
          userId: validKey.userId,
          keyId: validKey.apiKeyId,
          organizationId: validKey.organizationId,
          createdByUserId: validKey.createdByUserId,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred during API key validation",
        });
      }
    }),

  /**
   * Get user information using an API key (for CLI whoami command)
   */
  whoami: publicProcedure
    .input(
      z.object({
        key: z
          .string()
          .min(1, "API key is required")
          .refine(
            (val) => val.startsWith(API_KEY_PREFIX),
            `API key must start with ${API_KEY_PREFIX}`,
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { key } = input;

      // Use the validation function from cloud API
      const validKey = await validateApiKey(key, db);

      if (!validKey) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        });
      }

      return {
        userId: validKey.userId,
        keyId: validKey.apiKeyId,
        organizationId: validKey.organizationId,
        createdByUserId: validKey.createdByUserId,
      };
    }),
} satisfies TRPCRouterRecord;