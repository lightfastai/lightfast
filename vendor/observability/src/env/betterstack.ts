import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const betterstackEnv = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: z.url().optional(),
  },
  server: {},
  runtimeEnv: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL:
      process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
