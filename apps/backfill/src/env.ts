import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

import { env as inngestEnv } from "@vendor/inngest/env";

/** Module-level validated env for non-Hono contexts (Inngest workflows, module-level init). */
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
