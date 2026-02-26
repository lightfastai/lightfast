import { createEnv as createCoreEnv } from "@t3-oss/env-core";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import type { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { z } from "zod";

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
};

/** Validated env from the Hono request context — use in route handlers. */
export const getEnv = (c: Context) =>
  createCoreEnv({
    server,
    runtimeEnv: honoEnv(c),
    emptyStringAsUndefined: true,
  });

/** Module-level validated env for non-Hono contexts (workflows, utilities, module-level init). */
export const env = createEnv({
  extends: [vercel(), upstashEnv, qstashEnv, dbEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server,
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
