import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { anthropicEnv } from "@repo/ai/anthropic-env";
import { openAiEnv } from "@repo/ai/openai-env";
import { openrouterEnv } from "@repo/ai/openrouter-env";
import { env as trpcEnv } from "@repo/trpc-client/env";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as dbEnv } from "@vendor/db/env";
import { env as inngestEnv } from "@vendor/inngest/env";

export const env = createEnv({
  extends: [
    vercel(),
    dbEnv,
    clerkEnvBase,
    trpcEnv,
    inngestEnv,
    openAiEnv,
    anthropicEnv,
    openrouterEnv,
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    CLERK_WEBHOOK_SECRET: z.string(),
    REDIS_URL: z.string().url(),

    // Search API configuration
    EXA_API_KEY: z.string(),
    TAVILY_API_KEY: z.string().optional(),
    SEARCH_API: z.enum(["exa", "tavily", "searxng"]).default("exa"),

    // SearXNG configuration
    SEARXNG_API_URL: z.string().url().optional(),
    SEARXNG_DEFAULT_DEPTH: z.enum(["basic", "advanced"]).default("basic"),
    SEARXNG_MAX_RESULTS: z.string().optional(),
    SEARXNG_ENGINES: z.string().optional(),
    SEARXNG_TIME_RANGE: z.string().optional(),
    SEARXNG_SAFESEARCH: z.string().optional(),
    SEARXNG_CRAWL_MULTIPLIER: z.string().optional(),

    // Redis configuration for caching
    USE_LOCAL_REDIS: z.enum(["true", "false"]).default("false"),
    LOCAL_REDIS_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
