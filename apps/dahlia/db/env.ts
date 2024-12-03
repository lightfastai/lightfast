import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { env as vendorDbEnv } from "@vendor/db/env";

export const env = createEnv({
  extends: [vendorDbEnv],
  server: {
    DAHLIA_APP_PG_VERSION: z
      .string()
      .optional()
      .default("16")
      .transform(Number),
    DAHLIA_APP_REGION_ID: z.enum(["aws-ap-southeast-2", "aws-us-east-1"]),
    DAHLIA_APP_ORG_ID: z.string().min(1),
    DAHLIA_APP_DB_URL: z.string().min(1),
    NODE_ENV: z.enum(["development", "production"]).optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
