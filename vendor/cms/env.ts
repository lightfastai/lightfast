import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * BaseHub draft mode: true in development for real-time content updates,
 * false in production to avoid calling Next.js draftMode() which forces
 * dynamic rendering (DYNAMIC_SERVER_USAGE error).
 */
export const isDraft = process.env.NODE_ENV === "development";

export const basehubEnv = createEnv({
  shared: {},
  server: {
    BASEHUB_TOKEN: z.string().min(1).startsWith("bshb_pk_"),
    // Admin token for write operations (mutations / transactions)
    BASEHUB_ADMIN_TOKEN: z.string().min(1),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
