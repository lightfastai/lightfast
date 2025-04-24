import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  shared: {},
  server: {
    ARCJET_ENV: z.enum(["development", "production"]).optional(),
    ARCJET_KEY: z.string().min(1).startsWith("ajkey_"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});

export const secureApiRequestEnv = createEnv({
  shared: {},
  server: {
    REQUEST_ID_SECRET: z.string().min(1),
    AUTO_REFRESH_EXPIRED_IDS: z
      .enum(["true", "false"])
      .default("true")
      .transform((val) => val === "true"),
  },
  client: {},
  experimental__runtimeEnv: {
    AUTO_REFRESH_EXPIRED_IDS: process.env.AUTO_REFRESH_EXPIRED_IDS,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
