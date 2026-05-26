import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as inngestEnv } from "@vendor/inngest/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { unkeyEnv } from "@vendor/unkey/env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), clerkEnvBase, sentryEnv, inngestEnv, unkeyEnv],
  shared: {},
  server: {
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
