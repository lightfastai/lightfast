import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

export const betterstackEnv = createEnv({
  extends: [vercel()],
  shared: {},
  server: {
    LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional(),
    LOGTAIL_URL: z.string().min(1).url().optional(),
  },
  client: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: z.string().min(1).url().optional(),
    NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL:
      process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL,
    NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});

export const sentryEnv = createEnv({
  extends: [],
  shared: {},
  server: {
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1),
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.enum(["development", "production"]),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
