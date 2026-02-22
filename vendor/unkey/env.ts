import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const unkeyEnv = createEnv({
  server: {
    UNKEY_ROOT_KEY: z.string().min(1).startsWith("unkey_"),
    UNKEY_API_ID: z.string().min(1).startsWith("api_"),
  },
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
