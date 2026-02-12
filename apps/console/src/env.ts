import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { clerkEnvBase } from "@vendor/clerk/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { env as knockEnv } from "@vendor/knock/env";
import { env as dbEnv } from "@db/console/env";
import { githubEnv } from "@repo/console-octokit-github/env";
import { vercelEnv } from "@repo/console-vercel/env";
import { upstashEnv } from "@vendor/upstash/env";
import { basehubEnv } from "@vendor/cms/env";

export const env = createEnv({
  extends: [
    vercel(),
    clerkEnvBase,
    knockEnv,
    dbEnv,
    sentryEnv,
    betterstackEnv,
    githubEnv,
    vercelEnv,
    upstashEnv,
    basehubEnv,
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
    // No ANTHROPIC_API_KEY needed - Vercel AI Gateway uses VERCEL_OIDC_TOKEN

    /**
     * Encryption key for storing sensitive data (OAuth tokens, API keys, etc.)
     * Must be 32 bytes (64 hex characters or 44 base64 characters)
     *
     * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     *
     * ! REQUIRED in all environments - no weak defaults allowed
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
              "Default ENCRYPTION_KEY is not allowed. Generate a secure key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
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
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
