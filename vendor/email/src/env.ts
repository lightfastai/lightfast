import { createEnv } from "@t3-oss/env-nextjs";
import { vendorApiKey } from "@repo/console-validation";

export const env = createEnv({
  server: {
    RESEND_API_KEY: vendorApiKey("re_"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
