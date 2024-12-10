import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel()],
  shared: {
    APP_ENV: z.enum(["prod", "staging", "preview", "dev"]).default("dev"), // Custom env for the app based on our dev env
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    CI: z.boolean().default(false),
  },
  server: {
    SENTRY_ORG: z.enum(["jps0000"]),
    SENTRY_PROJECT: z.enum(["iv-jps0000-ai-repo-search", "dahlia-app"]),
    SENTRY_AUTH_TOKEN: z.string().min(1).startsWith("sntrys_"),
  },
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1),
  },
  experimental__runtimeEnv: {
    APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
