import { providerEnv } from "@repo/app-providers/env";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { env as inngestEnv } from "@vendor/inngest/env";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [
    vercel(),
    sentryEnv,
    betterstackEnv,
    upstashEnv,
    providerEnv,
    inngestEnv,
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    // Service auth — JWT shared secret for cross-service calls
    SERVICE_JWT_SECRET: z.string().min(32),

    // Token vault encryption (32 bytes: 64 hex chars or 44 base64 chars)
    ENCRYPTION_KEY: z.string().min(44),
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
