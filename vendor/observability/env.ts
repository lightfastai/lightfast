import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel()],
  shared: {
    APP_ENV: z.enum(["prod", "staging", "preview", "dev"]).default("dev"),
  },
  server: {},
  client: {},
  experimental__runtimeEnv: {
    APP_ENV: process.env.APP_ENV,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
