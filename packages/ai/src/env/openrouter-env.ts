import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const openrouterEnv = createEnv({
  server: {
    OPENROUTER_API_KEY: z.string().min(1),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
