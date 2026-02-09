import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { vendorApiKey } from "@repo/console-validation";

export const posthogEnv = createEnv({
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: vendorApiKey("phc_"),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).url(), // @important use in posthog server still..
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
