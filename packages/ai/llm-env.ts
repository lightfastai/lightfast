import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const llmEnv = createEnv({
  server: {
    VOYAGE_API_KEY: z.string().min(1).startsWith("pa-"),
    OPENAI_API_KEY: z.string().min(1).startsWith("sk-proj-"),
    ANTHROPIC_API_KEY: z.string().min(1).startsWith("sk-ant-"),
    BRAINTRUST_API_KEY: z.string().min(1).startsWith("sk-"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
