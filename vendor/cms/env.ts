import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { vendorApiKey } from "@repo/console-validation";

export const basehubEnv = createEnv({
  shared: {},
  server: {
    BASEHUB_TOKEN: vendorApiKey("bshb_pk_"),
    // Admin token for write operations (mutations / transactions)
    BASEHUB_ADMIN_TOKEN: z.string().min(1),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
