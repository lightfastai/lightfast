import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const anthropicEnv = createEnv({
  server: {
    ANTHROPIC_API_KEY: z.string().min(1).startsWith("sk-ant-"),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
});
