import { createEnv } from "@t3-oss/env-core";
import { render } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

export const env = createEnv({
  extends: [render()],
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    R2_ACCESS_KEY_ID: z.string().default("test-key"),
    R2_SECRET_ACCESS_KEY: z.string().default("test-secret"),
    R2_ACCOUNT_ID: z.string().default("test-account"),
    PORT: z.coerce.number().default(4104),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
