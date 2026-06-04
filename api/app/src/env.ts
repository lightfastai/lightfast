import { createEnv } from "@t3-oss/env-nextjs";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as inngestEnv } from "@vendor/inngest/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { unkeyEnv } from "@vendor/unkey/env";
import { z } from "zod";

const isConnectorMcpAuthSecretRequired =
  process.env.VERCEL_ENV === "production" ||
  (process.env.VERCEL_ENV === undefined &&
    process.env.NODE_ENV === "production");

export const env = createEnv({
  extends: [clerkEnvBase, sentryEnv, inngestEnv, unkeyEnv],
  shared: {},
  server: {
    CLERK_CLI_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    CLERK_DESKTOP_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    DEVELOPER_AUTH_BOX_ORIGIN: z.string().url().optional(),
    DEVELOPER_AUTH_BOX_TOKEN: z.string().min(1).optional(),
    ENCRYPTION_KEY: z
      .string()
      .refine(
        (key) =>
          /^[0-9a-f]{64}$/i.test(key) || /^[A-Za-z0-9+/]{43}=$/.test(key),
        "ENCRYPTION_KEY must be 32 bytes as 64 hex chars or 44 base64 chars"
      ),
    GITHUB_API_VERSION: z.string().min(1).default("2022-11-28"),
    GITHUB_APP_CLIENT_ID: z.string().min(1),
    GITHUB_APP_CLIENT_SECRET: z.string().min(1),
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_APP_SLUG: z.string().min(1),
    GITHUB_APP_WEBHOOK_SECRET: z.string().min(1),
    GITHUB_APP_ENDPOINT_ORIGIN: z.string().url().optional(),
    CONNECTOR_MCP_AUTH_SECRET: isConnectorMcpAuthSecretRequired
      ? z.string().min(32)
      : z.string().min(32).optional(),
    LINEAR_API_ORIGIN: z.string().url().optional(),
    LINEAR_CLIENT_ID: z.string().min(1).optional(),
    LINEAR_CLIENT_SECRET: z.string().min(1).optional(),
    LINEAR_MCP_ENDPOINT: z.string().url().optional(),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
    X_API_ORIGIN: z.string().url().optional(),
    X_OAUTH_ORIGIN: z.string().url().optional(),
    X_CLIENT_ID: z.string().min(1).optional(),
    X_CLIENT_SECRET: z.string().min(1).optional(),
    X_MCP_ENDPOINT: z.string().url().optional(),
  },
  client: {},
  experimental__runtimeEnv: {
    CLERK_CLI_OAUTH_CLIENT_ID: process.env.CLERK_CLI_OAUTH_CLIENT_ID,
    CLERK_DESKTOP_OAUTH_CLIENT_ID: process.env.CLERK_DESKTOP_OAUTH_CLIENT_ID,
    DEVELOPER_AUTH_BOX_ORIGIN: process.env.DEVELOPER_AUTH_BOX_ORIGIN,
    DEVELOPER_AUTH_BOX_TOKEN: process.env.DEVELOPER_AUTH_BOX_TOKEN,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    GITHUB_API_VERSION: process.env.GITHUB_API_VERSION,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
    GITHUB_APP_WEBHOOK_SECRET: process.env.GITHUB_APP_WEBHOOK_SECRET,
    GITHUB_APP_ENDPOINT_ORIGIN: process.env.GITHUB_APP_ENDPOINT_ORIGIN,
    CONNECTOR_MCP_AUTH_SECRET: process.env.CONNECTOR_MCP_AUTH_SECRET,
    LINEAR_API_ORIGIN: process.env.LINEAR_API_ORIGIN,
    LINEAR_CLIENT_ID: process.env.LINEAR_CLIENT_ID,
    LINEAR_CLIENT_SECRET: process.env.LINEAR_CLIENT_SECRET,
    LINEAR_MCP_ENDPOINT: process.env.LINEAR_MCP_ENDPOINT,
    VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
    X_API_ORIGIN: process.env.X_API_ORIGIN,
    X_OAUTH_ORIGIN: process.env.X_OAUTH_ORIGIN,
    X_CLIENT_ID: process.env.X_CLIENT_ID,
    X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
    X_MCP_ENDPOINT: process.env.X_MCP_ENDPOINT,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
