import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { env as dbEnv } from "@vendor/db/env";

export const env = createEnv({
  extends: [dbEnv],
  shared: {
    NODE_ENV: z.enum(["development", "production"]).optional(),
  },
  server: {},
  client: {},
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
