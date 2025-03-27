import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel()],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    CI: z.boolean().default(false),
  },
  server: {
    // Added by Vercel
    NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
    // Added by Sentry
    // SENTRY_ORG: z.enum(["jps0000"]),
    // SENTRY_PROJECT: z.enum(["react-td-app"]),
    // SENTRY_AUTH_TOKEN: z.string().min(1).startsWith("sntrys_"),
  },
  client: {
    // A custom env for the app based on our dev env
    NEXT_PUBLIC_APP_ENV: z
      .enum(["prod", "staging", "preview", "dev"])
      .default("dev"),
    // NEXT_PUBLIC_SENTRY_DSN: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
    // NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
