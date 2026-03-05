import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v3";

export const env = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    LIGHTFAST_API_URL: z.string().url().default("https://lightfast.ai"),
    LIGHTFAST_API_KEY: z.string().optional(),
  },
  runtimeEnv: {
    LIGHTFAST_API_URL: process.env.LIGHTFAST_API_URL,
    LIGHTFAST_API_KEY: process.env.LIGHTFAST_API_KEY,
  },
  emptyStringAsUndefined: true,
});
