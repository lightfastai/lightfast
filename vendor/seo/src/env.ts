import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const seoEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  },
  runtimeEnv: {
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
