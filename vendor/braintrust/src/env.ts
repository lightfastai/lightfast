import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const braintrustEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    BRAINTRUST_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
