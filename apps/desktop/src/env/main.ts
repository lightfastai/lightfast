import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

declare const __SENTRY_DSN__: string | undefined;

const buildFlavor = z.enum(["dev", "preview", "prod"]);

export const mainEnv = createEnv({
  server: {
    SENTRY_DSN: z.string().url().optional(),
    LIGHTFAST_API_URL: z.string().url().default("http://localhost:3024"),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1, "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    BUILD_FLAVOR: buildFlavor.optional(),
    SPARKLE_FEED_URL: z.string().url().optional(),
    SQUIRREL_FEED_URL: z.string().url().optional(),
    LIGHTFAST_REMOTE_DEBUG_PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .optional(),
  },
  runtimeEnv: {
    SENTRY_DSN:
      typeof __SENTRY_DSN__ !== "undefined" && __SENTRY_DSN__ !== ""
        ? __SENTRY_DSN__
        : process.env.SENTRY_DSN,
    LIGHTFAST_API_URL: process.env.LIGHTFAST_API_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    BUILD_FLAVOR: process.env.BUILD_FLAVOR,
    SPARKLE_FEED_URL: process.env.SPARKLE_FEED_URL,
    SQUIRREL_FEED_URL: process.env.SQUIRREL_FEED_URL,
    LIGHTFAST_REMOTE_DEBUG_PORT: process.env.LIGHTFAST_REMOTE_DEBUG_PORT,
  },
  isServer: true,
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
