import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { clerkEnvBase } from "@vendor/clerk/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { githubEnv } from "@repo/console-octokit-github/env";
import { consoleM2MEnv } from "@repo/console-clerk-m2m/env";
import { vercelEnv } from "@repo/console-vercel/env";

export const env = createEnv({
  extends: [vercel(), clerkEnvBase, sentryEnv, githubEnv, consoleM2MEnv, vercelEnv],
  shared: {},
  server: {
    /**
     * Gateway API key for authenticating requests to the Gateway service.
     * The Gateway URL is resolved via @vercel/related-projects.
     */
    GATEWAY_API_KEY: z.string().min(1),

    /**
     * Encryption key for decrypting OAuth tokens from database
     * Must match the key used by apps/console to encrypt tokens
     *
     * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     *
     * ⚠️ REQUIRED in all environments - no weak defaults allowed
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
      .refine(
        (key) => {
          // Reject weak default key (all zeros)
          const weakKey =
            "0000000000000000000000000000000000000000000000000000000000000000";
          if (key === weakKey) {
            throw new Error(
              'Default ENCRYPTION_KEY is not allowed. Generate a secure key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
            );
          }
          return true;
        },
        {
          message:
            "ENCRYPTION_KEY must be a cryptographically secure random value",
        },
      ),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
