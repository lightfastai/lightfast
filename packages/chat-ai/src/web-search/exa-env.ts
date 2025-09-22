import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Environment schema for Exa-powered web search.
 */
export const exaEnv = createEnv({
  server: {
    EXA_API_KEY: z
      .string()
      .min(1)
      .describe("API key for Exa web search"),
  },
  runtimeEnv: {
    EXA_API_KEY: process.env.EXA_API_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
