import { createEnv } from "@t3-oss/env-core";
import type { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { z } from "zod";

const server = {
  GATEWAY_API_KEY: z.string().min(1),
  INNGEST_APP_NAME: z.string().min(1).startsWith("lightfast-"),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).startsWith("signkey-").optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
};

const _createEnv = (c: Context) =>
  createEnv({
    clientPrefix: "" as const,
    client: {},
    server,
    runtimeEnv: honoEnv<Record<keyof typeof server, string | undefined>>(c),
    emptyStringAsUndefined: true,
  });

export type BackfillEnv = ReturnType<typeof _createEnv>;

const envCache = new WeakMap<object, BackfillEnv>();

/** Validated env from the Hono request context — cached per request. */
export const getEnv = (c: Context): BackfillEnv => {
  const cached = envCache.get(c);
  if (cached) {return cached;}
  const validated = _createEnv(c);
  envCache.set(c, validated);
  return validated;
};

/** Module-level validated env for non-Hono contexts (Inngest workflows, module-level init). */
export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    GATEWAY_API_KEY: process.env.GATEWAY_API_KEY,
    INNGEST_APP_NAME: process.env.INNGEST_APP_NAME,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
