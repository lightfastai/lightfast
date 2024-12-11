import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  shared: {},
  server: {
    DATABASE_URL: z.string().min(1).url(),
    DATABASE_URL_UNPOOLED: z.string().min(1).url(),
    NEON_API_KEY: z.string().min(1),
    NEON_ORG_ID: z.string().min(1),
    NEON_REGION_ID: z.string().min(1),
    NEON_PG_VERSION: z.string().default("16").transform(Number),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
