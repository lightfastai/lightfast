import { createEnv } from "@t3-oss/env-core";
import { env as vendorDbEnv } from "@vendor/db/env";

export const env = createEnv({
  extends: [vendorDbEnv],
  clientPrefix: "" as const,
  client: {},
  server: {},
  runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
