import { vercel } from "@t3-oss/env-core/presets-zod";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { env as trpcEnv } from "@repo/trpc-client/env";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as inngestEnv } from "@vendor/inngest/env";

export const env = createEnv({
  extends: [vercel(), inngestEnv, trpcEnv, clerkEnvBase],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    FORCE_BASE_URL: z.string().optional(),
  },
  server: {},
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NODE_ENV: process.env.NODE_ENV,
    FORCE_BASE_URL: process.env.FORCE_BASE_URL,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
