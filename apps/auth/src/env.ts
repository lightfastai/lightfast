import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { env as dbEnv } from "@vendor/db/env";
import { env as emailEnv } from "@vendor/email/env";
import { openauthEnv } from "@vendor/openauth/env";

export const env = createEnv({
  extends: [emailEnv, dbEnv, openauthEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    // Add other server-side environment variables specific to the auth app here
  },
  client: {
    // For client variables, prefix them with `NEXT_PUBLIC_`
    // Example: NEXT_PUBLIC_SOME_VAR: z.string().min(1),
    NEXT_PUBLIC_FRONTEND_URL: z.string().url(),
    NEXT_PUBLIC_AUTH_URL: z.string().url(),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   * We need to manually specify them runtimeEnv since we are not using the nextjs preset.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    // For client variables: NEXT_PUBLIC_SOME_VAR: process.env.NEXT_PUBLIC_SOME_VAR,
    NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL,
    NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
