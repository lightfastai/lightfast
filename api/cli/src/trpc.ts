/**
 * CLI-specific tRPC configuration
 * 
 * Simplified version that imports from cloud API to avoid duplication
 */

import { db } from "@db/cloud/client";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";

/**
 * CLI Session type - only supports API key authentication
 */
export type CliSession = {
  userId: string;
  apiKeyId: string;
  organizationId: string;
  organizationRole: string;
  createdByUserId: string;
} | null;

/**
 * CLI Context creation
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "cli";
  
  console.info(`>>> CLI tRPC Request from ${source}`);
  
  return {
    headers: opts.headers,
    db,
  };
};

/**
 * Initialize tRPC for CLI
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

/**
 * Create router
 */
export const createTRPCRouter = t.router;

/**
 * Create server-side caller
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * API key protected procedure
 * 
 * Requires authentication via API key and provides auth context
 */
export const apiKeyProtectedProcedure = publicProcedure
  .input(
    z.object({
      apiKey: z
        .string()
        .min(1, "API key is required")
        .refine(
          (val) => val.startsWith("lf_"),
          "API key must start with lf_",
        ),
    }).extend({
      // Other input fields will be merged with this
    })
  )
  .use(async ({ ctx, input, next }) => {
    const { db } = ctx;
    const { apiKey } = input;

    // Import validation function from cloud API
    const { validateApiKey } = await import("@api/cloud");
    
    // Validate API key
    const validKey = await validateApiKey(apiKey, db);

    if (!validKey) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid API key",
      });
    }

    return next({
      ctx: {
        ...ctx,
        auth: {
          userId: validKey.userId,
          apiKeyId: validKey.apiKeyId,
          organizationId: validKey.organizationId,
          createdByUserId: validKey.createdByUserId,
        },
      },
    });
  });

// Re-export for convenience
export { TRPCError } from "@trpc/server";