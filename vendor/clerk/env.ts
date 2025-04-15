import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Base Clerk environment variables (without webhook secret)
export const clerkEnvBase = createEnv({
  shared: {},
  server: {
    CLERK_SECRET_KEY: z.string().min(1).startsWith("sk_"),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).startsWith("pk_"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    // Note: Server variables are not included in experimental__runtimeEnv by default
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});

// Extended Clerk environment variables (includes webhook secret)
export const clerkEnvWithWebhook = createEnv({
  extends: [clerkEnvBase], // Extend the base configuration
  shared: {},
  server: {
    // Add the webhook secret here
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).startsWith("whsec_"),
  },
  client: {}, // Client vars are inherited from clerkEnvBase
  experimental__runtimeEnv: {
    // Runtime env vars are also inherited
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
