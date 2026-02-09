import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { vendorApiKey } from "@repo/console-validation";

export const dbEnv = createEnv({
  shared: {},
  server: {
    DATABASE_HOST: z
      .string()
      .min(1)
      .refine((v) => !v.startsWith("pscale_pw_") && !v.startsWith("pscale_api_"), {
        message: "DATABASE_HOST should be a hostname, not a credential",
      }),
    DATABASE_USERNAME: vendorApiKey("pscale_api_"),
    DATABASE_PASSWORD: vendorApiKey("pscale_pw_"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});

// Also export as 'env' for backward compatibility with existing imports
export const env = dbEnv;
