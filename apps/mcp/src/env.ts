import "@tanstack/react-start/server-only";

import { env as dbEnv } from "@db/app/env";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const vercelEnvSchema = z
  .enum(["development", "preview", "production"])
  .default("development");

export const env = createEnv({
  extends: [dbEnv],
  clientPrefix: "VITE_",
  client: {},
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    MCP_AUTH_ISSUER: z.string().url(),
    MCP_RESOURCE_URL: z.string().url(),
    SERVICE_JWT_SECRET: z.string().min(32),
    VERCEL_ENV: vercelEnvSchema,
  },
  runtimeEnv: {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
    MCP_AUTH_ISSUER: process.env.MCP_AUTH_ISSUER,
    MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL,
    SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
