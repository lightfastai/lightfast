import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { sentryEnv } from "@vendor/observability/sentry-env";

export const env = createEnv({
  extends: [
    vercel(),
    sentryEnv,
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
