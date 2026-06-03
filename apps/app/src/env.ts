import { env as dbEnv } from "@db/app/env";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { braintrustEnv } from "@vendor/braintrust/env";
import { clerkEnvBase } from "@vendor/clerk/env";
import { unkeyEnv } from "@vendor/unkey/env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), clerkEnvBase, dbEnv, braintrustEnv, upstashEnv, unkeyEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1),
    SENTRY_DSN: z.string().min(1),
    SENTRY_ORG: z.string().min(1),
    SENTRY_PROJECT: z.string().min(1),
    SERVICE_JWT_SECRET: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1),
    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("https://lightfast.ai"),
    // Browser-visible GitHub web origin. Only set in local dev by the GitHub
    // emulator; unset in prod, where consumers fall back to https://github.com.
    NEXT_PUBLIC_GITHUB_APP_ENDPOINT_ORIGIN: z.string().url().optional(),
    NEXT_PUBLIC_WWW_URL: z.string().url().default("https://lightfast.ai"),
    NEXT_PUBLIC_PLATFORM_URL: z
      .string()
      .url()
      .default("https://lightfast-platform.vercel.app"),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GITHUB_APP_ENDPOINT_ORIGIN:
      process.env.NEXT_PUBLIC_GITHUB_APP_ENDPOINT_ORIGIN,
    NEXT_PUBLIC_WWW_URL: process.env.NEXT_PUBLIC_WWW_URL,
    NEXT_PUBLIC_PLATFORM_URL: process.env.NEXT_PUBLIC_PLATFORM_URL,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
