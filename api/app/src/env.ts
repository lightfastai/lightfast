import { githubEnv } from "@repo/app-octokit-github/env";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as inngestEnv } from "@vendor/inngest/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel(), clerkEnvBase, sentryEnv, githubEnv, inngestEnv],
  shared: {},
  server: {
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),

    /**
     * Encryption key for decrypting OAuth tokens from database
     * Must match the key used by apps/app to encrypt tokens
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
        }
      )
      .refine(
        (key) => {
          // Reject weak default key (all zeros)
          const weakKey =
            "0000000000000000000000000000000000000000000000000000000000000000";
          if (key === weakKey) {
            throw new Error(
              "Default ENCRYPTION_KEY is not allowed. Generate a secure key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
            );
          }
          return true;
        },
        {
          message:
            "ENCRYPTION_KEY must be a cryptographically secure random value",
        }
      ),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
