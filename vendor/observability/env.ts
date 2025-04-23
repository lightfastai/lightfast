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
  shared: {},
  server: {
    SENTRY_ORG: vercelOnlyRequired(z.string().min(1)),
    SENTRY_PROJECT: vercelOnlyRequired(z.string().min(1)),
    SENTRY_AUTH_TOKEN: vercelOnlyRequired(z.string().min(1)),
  },
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
