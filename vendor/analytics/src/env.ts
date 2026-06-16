import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const posthogEnv = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).startsWith("phc_"),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).url(), // @important use in posthog server still..
  },
  server: {},
  runtimeEnv: {
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
