import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

const server = {
  GATEWAY_API_KEY: z.string().min(1),
  SENTRY_DSN: z.string().url().optional(),
  INNGEST_APP_NAME: z.string().min(1).startsWith("lightfast-"),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).startsWith("signkey-").optional(),
  LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional(),
};

/** Module-level validated env — single source of truth for all backfill env vars. */
export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
  extends: [vercel()],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(4109),
  },
  server,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    INNGEST_APP_NAME: process.env.INNGEST_APP_NAME,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
