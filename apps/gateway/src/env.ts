import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { upstashEnv } from "@vendor/upstash/env";
import { qstashEnv } from "@vendor/qstash/env";
import { env as dbEnv } from "@db/gateway/env";

export const env = createEnv({
  extends: [vercel(), upstashEnv, qstashEnv, dbEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    // Service auth
    GATEWAY_API_KEY: z.string().min(1),
    GATEWAY_WEBHOOK_SECRET: z.string().min(1),
    ENCRYPTION_KEY: z.string().min(32),

    // GitHub
    GITHUB_APP_SLUG: z.string().min(1),
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_WEBHOOK_SECRET: z.string().min(1),

    // Vercel
    VERCEL_CLIENT_SECRET_ID: z.string().min(1),
    VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
    VERCEL_INTEGRATION_SLUG: z.string().min(1),

    // Linear
    LINEAR_CLIENT_ID: z.string().min(1),
    LINEAR_CLIENT_SECRET: z.string().min(1),
    LINEAR_WEBHOOK_SIGNING_SECRET: z.string().min(1),

    // Sentry
    SENTRY_CLIENT_ID: z.string().min(1),
    SENTRY_CLIENT_SECRET: z.string().min(1),

    // GitHub App (private key for installation token generation)
    GITHUB_PRIVATE_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
