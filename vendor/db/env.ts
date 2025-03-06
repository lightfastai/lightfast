import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  shared: {},
  server: {
    DATABASE_URL: z.string().min(1).url(),
    DATABASE_URL_UNPOOLED: z.string().min(1).url(),
    /**
     * These values are used to connect to the Neon through the Neon API.
     * However, we only use these for Tenant clients, so we don't need them for the app.
     * This also means that non-tenant apps DO NOT need these values.
     * @todo refactor this to be more clear whether a user is creating a tenant app or not.
     */
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
