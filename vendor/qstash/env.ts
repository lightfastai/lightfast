import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * QStash environment variables
 *
 * Required:
 * - QSTASH_TOKEN: QStash API token for publishing messages
 * - QSTASH_CURRENT_SIGNING_KEY: Current signing key for verifying QStash requests
 * - QSTASH_NEXT_SIGNING_KEY: Next signing key for verifying QStash requests (key rotation)
 *
 * Optional:
 * - QSTASH_URL: Override QStash API endpoint
 */
export const qstashEnv = createEnv({
  server: {
    QSTASH_TOKEN: z.string().min(1),
    QSTASH_URL: z.string().url().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
    QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
  },
  runtimeEnv: {
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_URL: process.env.QSTASH_URL,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
