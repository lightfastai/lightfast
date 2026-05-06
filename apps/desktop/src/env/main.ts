import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

declare const __SENTRY_DSN__: string | undefined;

export const mainEnv = createEnv({
  server: {
    SENTRY_DSN: z.string().url().optional(),
    SPARKLE_FEED_URL: z.string().url().optional(),
    SQUIRREL_FEED_URL: z.string().url().optional(),
    LIGHTFAST_APP_ORIGIN: z.string().url().optional(),
    LIGHTFAST_REMOTE_DEBUG_PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65_535)
      .optional(),
  },
  runtimeEnv: {
    SENTRY_DSN:
      typeof __SENTRY_DSN__ !== "undefined" && __SENTRY_DSN__ !== ""
        ? __SENTRY_DSN__
        : process.env.SENTRY_DSN,
    SPARKLE_FEED_URL: process.env.SPARKLE_FEED_URL,
    SQUIRREL_FEED_URL: process.env.SQUIRREL_FEED_URL,
    LIGHTFAST_APP_ORIGIN: process.env.LIGHTFAST_APP_ORIGIN,
    LIGHTFAST_REMOTE_DEBUG_PORT: process.env.LIGHTFAST_REMOTE_DEBUG_PORT,
  },
  isServer: true,
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
