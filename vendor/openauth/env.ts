import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const openauthEnv = createEnv({
  shared: {},
  server: {
    OPENAUTH_ISSUER_URL: z.string().url(),
  },
  client: {},
  experimental__runtimeEnv: {
    OPENAUTH_ISSUER_URL: process.env.OPENAUTH_ISSUER_URL,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
