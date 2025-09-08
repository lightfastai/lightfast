/**
 * CLI-specific tRPC configuration
 * 
 * Simplified version that imports from cloud API to avoid duplication
 */

import { db } from "@db/cloud/client";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

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

// Re-export for convenience
export { TRPCError } from "@trpc/server";