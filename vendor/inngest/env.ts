import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Helper to make environment variables optional in non-Vercel environments
// const vercelOnlyRequired = <T extends z.ZodTypeAny>(schema: T) =>
//   process.env.VERCEL === "1" ? schema : schema.optional();

export const env = createEnv({
  server: {
    INNGEST_APP_NAME: z.string().min(1).startsWith("lightfast-"),
    // Only require these in Vercel environment
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
    INNGEST_SIGNING_KEY: z.string().min(1).startsWith("signkey-").optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
