import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const flagsEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    FLAGS: z.string().min(1).optional(),
  },
  runtimeEnv: {
    FLAGS: process.env.FLAGS,
  },
  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
