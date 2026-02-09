import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { vendorApiKey } from "@repo/console-validation";

export const browserbaseEnv = createEnv({
  server: {
    BROWSERBASE_API_KEY: vendorApiKey("bb_"),
    BROWSERBASE_PROJECT_ID: z.string().uuid(),
  },
  runtimeEnv: {
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
  },
  emptyStringAsUndefined: true,
});