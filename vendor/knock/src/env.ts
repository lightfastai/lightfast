import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    KNOCK_API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY: z.string().min(1),
    NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID: z.string().uuid(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY,
    NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID: process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
