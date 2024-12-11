import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  extends: [],
  shared: {
    NODE_ENV: z.enum(["development", "production"]).optional(),
  },
  server: {
    CLERK_SECRET_KEY: z.string().min(1).startsWith("sk_"),
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).startsWith("whsec_"),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).startsWith("pk_"),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
