import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Upstash Workflow environment variables
 *
 * Required:
 * - QSTASH_TOKEN: QStash API token for workflow orchestration
 *
 * Optional:
 * - QSTASH_URL: Override QStash API endpoint (default: https://qstash.upstash.io)
 */
export const env = createEnv({
  server: {
    QSTASH_TOKEN: z.string().min(1),
    QSTASH_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_URL: process.env.QSTASH_URL,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
