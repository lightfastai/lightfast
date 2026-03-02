import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const dbEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    DATABASE_HOST: z
      .string()
      .min(1)
      .refine((v) => !v.startsWith("pscale_pw_") && !v.startsWith("pscale_api_"), {
        message: "DATABASE_HOST should be a hostname, not a credential",
      }),
    DATABASE_USERNAME: z.string().startsWith("pscale_api_"),
    DATABASE_PASSWORD: z.string().startsWith("pscale_pw_"),
  },
  runtimeEnv: {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});

// Also export as 'env' for backward compatibility with existing imports
export const env = dbEnv;
