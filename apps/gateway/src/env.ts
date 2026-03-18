import { PROVIDER_ENVS } from "@repo/console-providers";
import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { dbEnv } from "@vendor/db/env";
import { env as inngestEnv } from "@vendor/inngest/env";
import { betterstackEdgeEnv } from "@vendor/observability/log/edge";
import { qstashEnv } from "@vendor/qstash/env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

const server = {
  GATEWAY_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
  SENTRY_DSN: z.url().optional(),
};

/** Module-level validated env — single source of truth for all gateway env vars. */
export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
  extends: [
    vercel(),
    betterstackEdgeEnv,
    upstashEnv,
    qstashEnv,
    dbEnv,
    inngestEnv,
    ...PROVIDER_ENVS(),
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(4110),
  },
  server,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
