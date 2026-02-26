import { createEnv as createCoreEnv } from "@t3-oss/env-core";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import type { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { z } from "zod";

import { githubOAuthEnv } from "@repo/console-octokit-github/oauth-env";
import { linearEnv } from "@repo/console-linear/env";
import { sentryIntegrationEnv } from "@repo/console-sentry/env";
import { vercelOAuthEnv } from "@repo/console-vercel/oauth-env";
import { upstashEnv } from "@vendor/upstash/env";
import { qstashEnv } from "@vendor/qstash/env";
import { dbEnv } from "@vendor/db/env";

const server = {
  GATEWAY_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
};

/** Validated env from the Hono request context — use in route handlers. */
export const getEnv = (c: Context) =>
  createCoreEnv({
    server,
    runtimeEnv: honoEnv(c),
    emptyStringAsUndefined: true,
  });

/** Module-level validated env for non-Hono contexts (workflows, utilities, module-level init). */
export const env = createEnv({
  extends: [
    vercel(),
    upstashEnv,
    qstashEnv,
    dbEnv,
    githubOAuthEnv,
    vercelOAuthEnv,
    linearEnv,
    sentryIntegrationEnv,
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server,
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
