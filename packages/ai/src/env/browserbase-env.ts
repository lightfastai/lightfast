import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const browserbaseEnv = createEnv({
  server: {
    BROWSERBASE_API_KEY: z.string().min(1).startsWith("bb_"),
    BROWSERBASE_PROJECT_ID: z.string().uuid(),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
});