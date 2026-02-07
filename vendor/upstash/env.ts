import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const upstashEnv = createEnv({
  shared: {},
  server: {
    KV_REST_API_URL: z.string().url(),
    KV_REST_API_TOKEN: z.string().min(1),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
