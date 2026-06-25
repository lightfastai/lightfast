import "@tanstack/react-start/server-only";

import { env as dbEnv } from "@db/app/env";
import { createEnv } from "@t3-oss/env-core";
import { clerkEnvBase } from "@vendor/clerk/env";
import { unkeyEnv } from "@vendor/unkey/env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [dbEnv, clerkEnvBase, upstashEnv, unkeyEnv],
  clientPrefix: "VITE_",
  client: {
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1).startsWith("pk_"),
    VITE_LIGHTFAST_APP_URL: z.string().url(),
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  server: {
    BRAINTRUST_API_KEY: z.string().min(1).optional(),
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
    MCP_RESOURCE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SERVICE_JWT_SECRET: z.string().min(32).optional(),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  runtimeEnv: {
    BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    HEALTH_CHECK_AUTH_TOKEN: process.env.HEALTH_CHECK_AUTH_TOKEN,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET,
    UNKEY_API_ID: process.env.UNKEY_API_ID,
    UNKEY_ROOT_KEY: process.env.UNKEY_ROOT_KEY,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VITE_LIGHTFAST_APP_URL:
      process.env.VITE_LIGHTFAST_APP_URL ?? "https://lightfast.ai",
    VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN,
    VITE_VERCEL_ENV:
      process.env.VITE_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});

export const sentryClientDsn = env.VITE_SENTRY_DSN;

export const sentryServerDsn = env.SENTRY_DSN ?? sentryClientDsn;
