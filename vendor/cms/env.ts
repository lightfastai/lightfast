import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const basehubEnv = createEnv({
  shared: {},
  server: {
    BASEHUB_TOKEN: z.string().min(1).startsWith("bshb_pk_"),
    BASEHUB_CHANGELOG_TOKEN: z
      .string()
      .min(1)
      .startsWith("bshb_pk_")
      .optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.CI ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.SKIP_ENV_VALIDATION === "true",
});

