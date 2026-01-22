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
    // Mixedbread configuration (for CLI sync commands)
    MXBAI_API_KEY: z.string(),
    MXBAI_STORE_ID: z.string(),
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]).default("development"),
    // Mixedbread client-side config (for search)
    NEXT_PUBLIC_MXBAI_API_KEY: z.string(),
    NEXT_PUBLIC_MXBAI_STORE_ID: z.string(),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_MXBAI_API_KEY: process.env.NEXT_PUBLIC_MXBAI_API_KEY,
    NEXT_PUBLIC_MXBAI_STORE_ID: process.env.NEXT_PUBLIC_MXBAI_STORE_ID,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
