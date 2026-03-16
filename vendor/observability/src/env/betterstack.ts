import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

export const betterstackEnv = createEnv({
  extends: [vercel()],
  shared: {},
  server: {
    BETTERSTACK_SOURCE_TOKEN: z.string().min(1).optional(),
    BETTERSTACK_INGESTING_HOST: z.url().optional(),
  },
  client: {
    NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST: z.url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST:
      process.env.NEXT_PUBLIC_BETTERSTACK_INGESTING_HOST,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
