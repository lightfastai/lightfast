import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Console-specific M2M (Machine-to-Machine) environment variables
 *
 * Setup (one-time in Clerk Dashboard):
 * 1. Create 3 machines: "tRPC API", "Webhook Handler", "Inngest Workflows"
 * 2. Configure scopes: webhook→tRPC, inngest→tRPC, tRPC→both
 * 3. Generate long-lived tokens (365 days) from webhook and inngest machines
 *
 * Architecture:
 * - tRPC Machine (receiver): Verifies ALL incoming M2M tokens using its secret
 * - Webhook Machine (sender): Sends pre-created token to authenticate with tRPC
 * - Inngest Machine (sender): Sends pre-created token to authenticate with tRPC
 *
 * The tRPC machine verifies tokens and checks the `subject` field
 * to identify which sender machine created the token
 */
export const consoleM2MEnv = createEnv({
  shared: {},
  server: {
    // tRPC Machine - Secret key to VERIFY all incoming M2M tokens
    CLERK_MACHINE_SECRET_KEY_TRPC: z.string().min(1).startsWith("ak_"),

    // Webhook Machine - Pre-created long-lived token (365 days)
    CLERK_M2M_TOKEN_WEBHOOK: z.string().min(1).startsWith("mt_"),
    CLERK_M2M_MACHINE_ID_WEBHOOK: z.string().min(1).startsWith("mch_"),

    // Inngest Machine - Pre-created long-lived token (365 days)
    CLERK_M2M_TOKEN_INNGEST: z.string().min(1).startsWith("mt_"),
    CLERK_M2M_MACHINE_ID_INNGEST: z.string().min(1).startsWith("mch_"),
  },
  client: {},
  experimental__runtimeEnv: {
    // Note: Server variables are not included in experimental__runtimeEnv by default
  },
  skipValidation:
    !!process.env.CI ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.SKIP_ENV_VALIDATION === "true",
});
