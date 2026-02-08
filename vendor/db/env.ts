import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const dbEnv = createEnv({
  shared: {},
  server: {
    DATABASE_HOST: z.string().min(1),
    DATABASE_USERNAME: z.string().startsWith("pscale_api_"),
    DATABASE_PASSWORD: z.string().startsWith("pscale_pw_"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});

// Also export as 'env' for backward compatibility with existing imports
export const env = dbEnv;
