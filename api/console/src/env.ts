import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { clerkEnvBase } from "@vendor/clerk/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { githubEnv } from "@repo/console-octokit-github/env";

export const env = createEnv({
  extends: [vercel(), clerkEnvBase, sentryEnv, githubEnv],
  shared: {},
  server: {
    /**
     * Encryption key for decrypting OAuth tokens from database
     * Must match the key used by apps/console to encrypt tokens
     */
    ENCRYPTION_KEY: z
      .string()
      .min(44)
      .refine(
        (key) => {
          // Validate hex (64 chars) or base64 (44 chars)
          const hexPattern = /^[0-9a-f]{64}$/i;
          const base64Pattern = /^[A-Za-z0-9+/]{43}=$/;
          return hexPattern.test(key) || base64Pattern.test(key);
        },
        {
          message:
            "ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)",
        },
      )
      .default(
        // Only allow default in development
        process.env.NODE_ENV === "development"
          ? "0000000000000000000000000000000000000000000000000000000000000000"
          : "",
      ),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
