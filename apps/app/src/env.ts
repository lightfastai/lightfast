import { env as dbEnv } from "@db/app/env";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { clerkEnvBase } from "@vendor/clerk/env";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [
    vercel(),
    clerkEnvBase,
    dbEnv,
    sentryEnv,
    betterstackEnv,
    upstashEnv,
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
    SERVICE_JWT_SECRET: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_WWW_URL: z.string().url().optional(),
    NEXT_PUBLIC_PLATFORM_URL: z.string().url().optional(),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WWW_URL: process.env.NEXT_PUBLIC_WWW_URL,
    NEXT_PUBLIC_PLATFORM_URL: process.env.NEXT_PUBLIC_PLATFORM_URL,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
