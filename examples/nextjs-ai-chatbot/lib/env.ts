import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /**
   * Server-side environment variables
   */
  server: {
    // Redis for session persistence (optional but recommended)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  },

  /**
   * Client-side environment variables
   * None needed for this example
   */
  client: {},

  /**
   * Runtime environment - for Next.js runtime
   * These are accessed from process.env in the route handler
   */
  runtimeEnv: {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  },

  /**
   * Skip validation during build and lint
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === 'lint',

  /**
   * Empty strings are treated as undefined
   */
  emptyStringAsUndefined: true,
});