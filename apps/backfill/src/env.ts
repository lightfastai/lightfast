import { createEnv } from "@t3-oss/env-core";
import type { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { z } from "zod";

import { env as inngestEnv } from "@vendor/inngest/env";

const server = {
  GATEWAY_API_KEY: z.string().min(1),
};

/** Validated env from the Hono request context — use in route handlers. */
export const getEnv = (c: Context) =>
  createEnv({
    server,
    runtimeEnv: honoEnv(c),
    emptyStringAsUndefined: true,
  });

/** Module-level validated env for non-Hono contexts (Inngest workflows, module-level init). */
export const env = createEnv({
  extends: [inngestEnv],
  server,
  runtimeEnv: {
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
