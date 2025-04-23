import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";

export const env = createEnv({
  extends: [vercel()],
  shared: {},
  server: {
    // Added by Vercel
  },
  client: {},
  experimental__runtimeEnv: {
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
