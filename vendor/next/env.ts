import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";

import { sentryEnv } from "@vendor/observability/sentry-env";

export const env = createEnv({
  extends: [vercel(), sentryEnv],
  shared: {},
  server: {
    // Added by Vercel
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
