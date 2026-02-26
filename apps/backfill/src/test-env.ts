import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import type { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { z } from "zod";

import { env as inngestEnv } from "@vendor/inngest/env";

export const getEnv = (c: Context) =>
  createEnv({
    server: { GATEWAY_API_KEY: z.string().min(1) },
    runtimeEnv: honoEnv(c),
    emptyStringAsUndefined: true,
  });

export const env = createEnv({
  extends: [vercel(), inngestEnv],
  server: { GATEWAY_API_KEY: z.string().min(1) },
  runtimeEnv: {
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
