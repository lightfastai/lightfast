import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const braintrustEnv = createEnv({
  extends: [],
  shared: {},
  server: {
    BRAINTRUST_OTEL_ENABLED: z
      .enum(["0", "1", "false", "true"])
      .optional(),
    BRAINTRUST_API_KEY: z.string().min(1).optional(),
    BRAINTRUST_PARENT: z.string().min(1).optional(),
    BRAINTRUST_API_URL: z.url().optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
