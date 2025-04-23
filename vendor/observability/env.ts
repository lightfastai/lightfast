import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

const vercelOnlyRequired = <T extends z.ZodTypeAny>(schema: T) =>
  process.env.VERCEL === "1" ? schema : schema.optional();

export const logtailEnv = createEnv({
  extends: [vercel()],
  shared: {},
  server: {
    LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});

export const sentryEnv = createEnv({
  extends: [],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    SENTRY_ORG: vercelOnlyRequired(z.string().min(1)),
    SENTRY_PROJECT: vercelOnlyRequired(z.string().min(1)),
    SENTRY_AUTH_TOKEN: vercelOnlyRequired(
      z.string().min(1).startsWith("sntrys_"),
    ),
  },
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
