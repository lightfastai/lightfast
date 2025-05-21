import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { env as dbEnv } from "@vendor/db/env";
import { env as emailEnv } from "@vendor/email/env";

export const env = createEnv({
  extends: [emailEnv, dbEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    // Add other server-side environment variables specific to the auth app here
    LIGHTFAST_AUTH_URL: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_OPENAUTH_ISSUER_URL: z.string().min(1),
    // For client variables, prefix them with `NEXT_PUBLIC_`
    // Example: NEXT_PUBLIC_SOME_VAR: z.string().min(1),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   * We need to manually specify them runtimeEnv since we are not using the nextjs preset.
   */
  experimental__runtimeEnv: {
    NEXT_PUBLIC_OPENAUTH_ISSUER_URL:
      process.env.NEXT_PUBLIC_OPENAUTH_ISSUER_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
