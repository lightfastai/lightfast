import "@tanstack/react-start/server-only";

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SENTRY_DSN: z.string().url().optional(),
  },
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    APP_INTERNAL_URL: z.string().url().optional(),
    MCP_AUTH_ISSUER: z.string().url(),
    MCP_RESOURCE_URL: z.string().url(),
    SERVICE_JWT_SECRET: z.string().min(32),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    APP_INTERNAL_URL: process.env.APP_INTERNAL_URL,
    MCP_AUTH_ISSUER: process.env.MCP_AUTH_ISSUER,
    MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL,
    SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});

export const appInternalUrl = env.APP_INTERNAL_URL ?? env.MCP_AUTH_ISSUER;
