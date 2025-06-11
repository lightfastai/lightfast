import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  /*
   * Server-side environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    // Convex handles deployment vs deploy key automatically
    // In development: CONVEX_DEPLOYMENT is used
    // In production: CONVEX_DEPLOY_KEY is used
    // We only need to validate what we actually use in our app
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // GitHub OAuth for Convex Auth
    AUTH_GITHUB_ID: z.string().optional(),
    AUTH_GITHUB_SECRET: z.string().optional(),
    // Site URL for authentication redirects
    SITE_URL: z.string().url(),
    // JWT private key for authentication tokens
    JWT_PRIVATE_KEY: z.string(),
    // JWKS for JWT verification
    JWKS: z.string(),
  },
  /*
   * Environment variables available on the client (and server).
   * 💡 You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   */
  client: {
    // Convex URL for client-side connections
    // This is the only Convex variable our app actually needs
    NEXT_PUBLIC_CONVEX_URL: z.string().url(),
    // Environment identifier for conditional logic
    NEXT_PUBLIC_APP_ENV: z
      .enum(["development", "preview", "production"])
      .default("development"),
  },
  /*
   * You can't destruct `process.env` as a regular object in the Next.js Edge Runtime (e.g.
   * Vercel Edge Functions) or Node.js < 20.4.0 (e.g. Vercel Serverless Functions).
   * This is because only explicitly accessed variables are replaced by webpack/edge.
   */
  runtimeEnv: {
    // Server-side
    NODE_ENV: process.env.NODE_ENV,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    SITE_URL: process.env.SITE_URL,
    JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY,
    JWKS: process.env.JWKS,
    // Client-side
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  },
  /*
   * Run `build` or `dev` with SKIP_ENV_VALIDATION to skip env validation.
   * This is especially useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /*
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
})

// Environment helpers for conditional logic
export const isDevelopment = env.NEXT_PUBLIC_APP_ENV === "development"
export const isPreview = env.NEXT_PUBLIC_APP_ENV === "preview"
export const isProduction = env.NEXT_PUBLIC_APP_ENV === "production"

// Convex URL helpers
export const getConvexUrl = () => env.NEXT_PUBLIC_CONVEX_URL
export const isLocalConvex = () =>
  env.NEXT_PUBLIC_CONVEX_URL.includes("127.0.0.1")
