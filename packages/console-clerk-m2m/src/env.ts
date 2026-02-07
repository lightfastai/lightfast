import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Console-specific M2M (Machine-to-Machine) environment variables
 *
 * Setup (one-time in Clerk Dashboard):
 * 1. Create 3 machines: "tRPC API", "Webhook Handler", "Inngest Workflows"
 * 2. Configure scopes: webhook→tRPC, inngest→tRPC, tRPC→both
 * 3. Copy each machine's secret key (ak_xxx)
 *
 * Architecture (Following Clerk's Pattern):
 * - Webhook Machine: Creates tokens on-demand with CLERK_MACHINE_SECRET_KEY_WEBHOOK
 * - Inngest Machine: Creates tokens on-demand with CLERK_MACHINE_SECRET_KEY_INNGEST
 * - tRPC Machine: Verifies incoming tokens with CLERK_MACHINE_SECRET_KEY_TRPC
 *
 * Token Flow:
 * 1. Sender (webhook/inngest) creates short-lived token (30s) using its secret
 * 2. Sender sends token in Authorization header
 * 3. Receiver (tRPC) verifies token using its secret
 * 4. Verified token's `subject` field identifies which machine sent it
 */
export const consoleM2MEnv = createEnv({
  shared: {},
  server: {
    // tRPC Machine - Secret key to VERIFY all incoming M2M tokens
    CLERK_MACHINE_SECRET_KEY_TRPC: z.string().min(1).startsWith("ak_"),

    // Webhook Machine - Secret key to CREATE tokens
    CLERK_MACHINE_SECRET_KEY_WEBHOOK: z.string().min(1).startsWith("ak_"),

    // Inngest Machine - Secret key to CREATE tokens
    CLERK_MACHINE_SECRET_KEY_INNGEST: z.string().min(1).startsWith("ak_"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.SKIP_ENV_VALIDATION === "true",
  emptyStringAsUndefined: true,
});
