import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    // Optional: Add health check auth token if you want to secure the endpoint
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
    // Mixedbread configuration (server-side for API route and CLI sync)
    MXBAI_API_KEY: z.string(),
    MXBAI_STORE_ID: z.string(),
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]).default("development"),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
