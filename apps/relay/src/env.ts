import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod/v3";

import { upstashEnv } from "@vendor/upstash/env";
import { qstashEnv } from "@vendor/qstash/env";
import { dbEnv } from "@vendor/db/env";

const server = {
  // Service auth
  GATEWAY_API_KEY: z.string().min(1),
  GATEWAY_WEBHOOK_SECRET: z.string().min(1),

  // Webhook verification secrets
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
  LINEAR_WEBHOOK_SIGNING_SECRET: z.string().min(1),
  SENTRY_CLIENT_SECRET: z.string().min(1),
  SENTRY_DSN: z.string().url().optional(),
  LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional(),
};

/** Module-level validated env — single source of truth for all relay env vars. */
export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
  extends: [vercel(), upstashEnv, qstashEnv, dbEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
    GATEWAY_WEBHOOK_SECRET: process.env.GATEWAY_WEBHOOK_SECRET,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    VERCEL_CLIENT_INTEGRATION_SECRET:
      process.env.VERCEL_CLIENT_INTEGRATION_SECRET,
    LINEAR_WEBHOOK_SIGNING_SECRET: process.env.LINEAR_WEBHOOK_SIGNING_SECRET,
    SENTRY_CLIENT_SECRET: process.env.SENTRY_CLIENT_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
