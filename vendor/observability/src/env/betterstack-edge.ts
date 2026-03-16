import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

export const betterstackEdgeEnv = createEnv({
  extends: [vercel()],
  clientPrefix: "" as const,
  client: {},
  server: {
    BETTERSTACK_SOURCE_TOKEN: z.string().min(1).optional(),
    BETTERSTACK_INGESTING_HOST: z.url().optional(),
  },
  runtimeEnv: {
    BETTERSTACK_SOURCE_TOKEN: process.env.BETTERSTACK_SOURCE_TOKEN,
    BETTERSTACK_INGESTING_HOST: process.env.BETTERSTACK_INGESTING_HOST,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
