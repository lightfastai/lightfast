import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Full Vercel env with all vars — used by console.
 */
export const vercelEnv = createEnv({
  server: {
    VERCEL_INTEGRATION_SLUG: z.string().min(1),
    VERCEL_CLIENT_SECRET_ID: z.string().min(1),
    VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
    VERCEL_REDIRECT_URI: z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG:
      process.env.NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
