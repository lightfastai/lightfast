import { createEnv } from "@t3-oss/env-core";
import { dbEnv as vendorDbEnv } from "@vendor/db/env";

export const env = createEnv({
  extends: [vendorDbEnv],
  clientPrefix: "" as const,
  client: {},
  server: {},
  runtimeEnv: {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
