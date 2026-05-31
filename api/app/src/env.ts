import { createEnv } from "@t3-oss/env-nextjs";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as inngestEnv } from "@vendor/inngest/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { unkeyEnv } from "@vendor/unkey/env";
import { z } from "zod";

const encryptionKeySchema = z
  .string()
  .refine(
    (key) => /^[0-9a-f]{64}$/i.test(key) || /^[A-Za-z0-9+/]{43}=$/.test(key),
    "ENCRYPTION_KEY must be 32 bytes as 64 hex chars or 44 base64 chars"
  );

export const env = createEnv({
  extends: [clerkEnvBase, sentryEnv, inngestEnv, unkeyEnv],
  shared: {},
  server: {
    CLERK_CLI_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    CLERK_DESKTOP_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    ENCRYPTION_KEY: encryptionKeySchema,
    GITHUB_API_VERSION: z.string().min(1).default("2022-11-28"),
    GITHUB_APP_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_APP_CLIENT_SECRET: z.string().min(1).optional(),
    GITHUB_APP_ID: z.string().min(1).optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
    GITHUB_APP_SLUG: z.string().min(1).optional(),
    GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).optional(),
    GITHUB_APP_ENDPOINT_ORIGIN: z.string().url().optional(),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  client: {},
  experimental__runtimeEnv: {
    CLERK_CLI_OAUTH_CLIENT_ID: process.env.CLERK_CLI_OAUTH_CLIENT_ID,
    CLERK_DESKTOP_OAUTH_CLIENT_ID: process.env.CLERK_DESKTOP_OAUTH_CLIENT_ID,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    GITHUB_API_VERSION: process.env.GITHUB_API_VERSION,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
    GITHUB_APP_WEBHOOK_SECRET: process.env.GITHUB_APP_WEBHOOK_SECRET,
    GITHUB_APP_ENDPOINT_ORIGIN: process.env.GITHUB_APP_ENDPOINT_ORIGIN,
    VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
