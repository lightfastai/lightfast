import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const unkeyEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    UNKEY_API_ID: z.string().min(1),
    UNKEY_ROOT_KEY: z.string().min(1),
  },
  runtimeEnv: {
    UNKEY_API_ID: process.env.UNKEY_API_ID,
    UNKEY_ROOT_KEY: process.env.UNKEY_ROOT_KEY,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
