import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const openauthEnv = createEnv({
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    OPENAUTH_ISSUER_URL: z.string().url(),
  },
  client: {},
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
