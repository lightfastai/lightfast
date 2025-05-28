import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

export const betterstackEnv = createEnv({
  extends: [vercel()],
  shared: {},
  server: {
    LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional(),
    LOGTAIL_URL: z.string().min(1).url().optional(),
  },
  client: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL: z.string().min(1).url().optional(),
    NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_URL:
      process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL,
    NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN:
      process.env.NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
