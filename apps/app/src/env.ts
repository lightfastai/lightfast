import "@tanstack/react-start/server-only";

import { env as dbEnv } from "@db/app/env";
import { createEnv } from "@t3-oss/env-core";
import { clerkEnvBase } from "@vendor/clerk/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { unkeyEnv } from "@vendor/unkey/env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

const vercelEnvSchema = z
  .enum(["development", "preview", "production"])
  .default("development");

const nodeEnvSchema = z
  .enum(["development", "production", "test"])
  .default("development");

const defaultAppUrl = "https://lightfast.ai";

export const env = createEnv({
  extends: [dbEnv, clerkEnvBase, sentryEnv, upstashEnv, unkeyEnv],
  clientPrefix: "VITE_",
  client: {
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1).startsWith("pk_"),
    VITE_LIGHTFAST_APP_URL: z.string().url(),
    VITE_LIGHTFAST_WWW_URL: z.string().url(),
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_VERCEL_ENV: vercelEnvSchema,
  },
  server: {
    BRAINTRUST_API_KEY: z.string().min(1).optional(),
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
    NODE_ENV: nodeEnvSchema,
    SENTRY_DSN: z.string().url().optional(),
    SERVICE_JWT_SECRET: z.string().min(32).optional(),
    VERCEL_ENV: vercelEnvSchema,
  },
  runtimeEnv: {
    BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    HEALTH_CHECK_AUTH_TOKEN: process.env.HEALTH_CHECK_AUTH_TOKEN,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    NODE_ENV: process.env.NODE_ENV,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET,
    UNKEY_API_ID: process.env.UNKEY_API_ID,
    UNKEY_ROOT_KEY: process.env.UNKEY_ROOT_KEY,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VITE_LIGHTFAST_APP_URL:
      process.env.VITE_LIGHTFAST_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      defaultAppUrl,
    VITE_CLERK_PUBLISHABLE_KEY:
      process.env.VITE_CLERK_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    VITE_LIGHTFAST_WWW_URL:
      process.env.VITE_LIGHTFAST_WWW_URL ??
      process.env.NEXT_PUBLIC_WWW_URL ??
      defaultAppUrl,
    VITE_SENTRY_DSN:
      process.env.VITE_SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    VITE_VERCEL_ENV:
      process.env.VITE_VERCEL_ENV ??
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.VERCEL_ENV ??
      "development",
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});

export const sentryClientDsn =
  env.VITE_SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryServerDsn = env.SENTRY_DSN ?? sentryClientDsn;
