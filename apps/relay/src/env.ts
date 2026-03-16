import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { dbEnv } from "@vendor/db/env";
import { betterstackEdgeEnv } from "@vendor/observability/log/edge";
import { qstashEnv } from "@vendor/qstash/env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod/v3";

const server = {
  // Service auth
  GATEWAY_API_KEY: z.string().min(1),
  GATEWAY_WEBHOOK_SECRET: z.string().min(1),

  // Webhook verification secrets
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  // Optional providers — only required when the provider is enabled
  VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1).optional(),
  LINEAR_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
  SENTRY_CLIENT_SECRET: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
};

/** Module-level validated env — single source of truth for all relay env vars. */
export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
  extends: [vercel(), betterstackEdgeEnv, upstashEnv, qstashEnv, dbEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(4108),
  },
  server,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
    GATEWAY_WEBHOOK_SECRET: process.env.GATEWAY_WEBHOOK_SECRET,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    VERCEL_CLIENT_INTEGRATION_SECRET:
      process.env.VERCEL_CLIENT_INTEGRATION_SECRET,
    LINEAR_WEBHOOK_SIGNING_SECRET: process.env.LINEAR_WEBHOOK_SIGNING_SECRET,
    SENTRY_CLIENT_SECRET: process.env.SENTRY_CLIENT_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
