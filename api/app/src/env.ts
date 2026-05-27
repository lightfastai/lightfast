import { createEnv } from "@t3-oss/env-nextjs";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as inngestEnv } from "@vendor/inngest/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { unkeyEnv } from "@vendor/unkey/env";
import { z } from "zod";

export const env = createEnv({
  extends: [clerkEnvBase, sentryEnv, inngestEnv, unkeyEnv],
  shared: {},
  server: {
    CLERK_CLI_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    CLERK_DESKTOP_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  client: {},
  experimental__runtimeEnv: {
    CLERK_CLI_OAUTH_CLIENT_ID: process.env.CLERK_CLI_OAUTH_CLIENT_ID,
    CLERK_DESKTOP_OAUTH_CLIENT_ID: process.env.CLERK_DESKTOP_OAUTH_CLIENT_ID,
    VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
