import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const upstashEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    KV_REST_API_URL: z.string().url(),
    KV_REST_API_TOKEN: z.string().min(1),
  },
  runtimeEnv: {
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
