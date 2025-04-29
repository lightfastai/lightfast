import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const openAiEnv = createEnv({
  server: {
    OPENAI_API_KEY: z.string().min(1).startsWith("sk-proj-"),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
});
