import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  shared: {},
  server: {
    LOGTAIL_SOURCE_TOKEN: z.string(),
    NODE_ENV: z.enum(["development", "production"]),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
