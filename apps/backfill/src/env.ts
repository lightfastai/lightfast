import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { env as inngestEnv } from "@vendor/inngest/env";

export const env = createEnv({
  extends: [vercel(), inngestEnv],
  server: {
    GATEWAY_API_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
