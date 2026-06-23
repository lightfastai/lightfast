import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    SLACK_WEBHOOK_URL: z.string().url(),
  },
  runtimeEnv: {
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
