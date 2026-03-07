import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    PINECONE_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
