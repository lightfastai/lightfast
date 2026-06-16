import "@tanstack/react-start/server-only";

import { env as dbEnv } from "@db/app/env";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  extends: [dbEnv],
  clientPrefix: "VITE_",
  client: {
    VITE_SENTRY_DSN: z.string().url().optional(),
  },
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    MCP_AUTH_ISSUER: z.string().url(),
    MCP_RESOURCE_URL: z.string().url(),
    SERVICE_JWT_SECRET: z.string().min(32),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  runtimeEnv: {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
    MCP_AUTH_ISSUER: process.env.MCP_AUTH_ISSUER,
    MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL,
    SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
