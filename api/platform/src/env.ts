import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { upstashEnv } from "@vendor/upstash/env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), sentryEnv, betterstackEnv, upstashEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  server: {
    SERVICE_JWT_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z
      .string()
      .min(44)
      .refine(
        (key) => {
          const hexPattern = /^[0-9a-f]{64}$/i;
          const base64Pattern = /^[A-Za-z0-9+/]{43}=$/;
          return hexPattern.test(key) || base64Pattern.test(key);
        },
        {
          message:
            "ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)",
        }
      )
      .refine((key) => key !== "0".repeat(64), {
        message:
          "ENCRYPTION_KEY must be a cryptographically secure random value",
      }),
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
