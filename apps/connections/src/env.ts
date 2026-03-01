import { linearEnv } from "@repo/console-linear/env";
import { githubOAuthEnv } from "@repo/console-octokit-github/oauth-env";
import { sentryIntegrationEnv } from "@repo/console-sentry/env";
import { vercelOAuthEnv } from "@repo/console-vercel/oauth-env";
import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { dbEnv } from "@vendor/db/env";
import { qstashEnv } from "@vendor/qstash/env";
import { upstashEnv } from "@vendor/upstash/env";
import type { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { z } from "zod";


const server = {
  GATEWAY_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
};

const _createEnv = (c: Context) =>
  createEnv({
    clientPrefix: "" as const,
    client: {},
    server,
    runtimeEnv: honoEnv<Record<keyof typeof server, string | undefined>>(c),
    emptyStringAsUndefined: true,
  });

export type ConnectionsEnv = ReturnType<typeof _createEnv>;

const envCache = new WeakMap<object, ConnectionsEnv>();

/**
 * Validated env from the Hono request context — cached per request.
 *
 * Only validates app-specific server variables (GATEWAY_API_KEY, ENCRYPTION_KEY).
 * Preset groups (vercel, upstash, db, OAuth, etc.) are validated once at module
 * load via the module-level `env` export and should be accessed from there or
 * from their respective package imports.
 */
export const getEnv = (c: Context): ConnectionsEnv => {
  const cached = envCache.get(c);
  if (cached) {return cached;}
  const validated = _createEnv(c);
  envCache.set(c, validated);
  return validated;
};

/** Module-level validated env for non-Hono contexts (workflows, utilities, module-level init). */
export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
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
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
