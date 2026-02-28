import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
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

export type GatewayEnv = ReturnType<typeof getEnv>;

/** Validated env from the Hono request context — use in route handlers. */
export const getEnv = (c: Context) =>
  createEnv({
    clientPrefix: "" as const,
    client: {},
    server,
    runtimeEnv: honoEnv<Record<keyof typeof server, string | undefined>>(c),
    emptyStringAsUndefined: true,
  });

/** Module-level validated env for non-Hono contexts (workflows, utilities, module-level init). */
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
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
