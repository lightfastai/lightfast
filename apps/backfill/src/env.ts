import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Module-level validated env for non-Hono contexts (Inngest workflows, module-level init). */
export const env = createEnv({
  server: {
    GATEWAY_API_KEY: z.string().min(1),
    INNGEST_APP_NAME: z.string().min(1).startsWith("lightfast-"),
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
    INNGEST_SIGNING_KEY: z.string().min(1).startsWith("signkey-").optional(),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .optional(),
  },
  runtimeEnv: {
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
    INNGEST_APP_NAME: process.env.INNGEST_APP_NAME,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
