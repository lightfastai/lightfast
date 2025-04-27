import { createEnv } from "@t3-oss/env-core";
import { render } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

import { falEnv } from "@repo/ai/fal-env";
import { openAiEnv } from "@repo/ai/openai-env";

const r2Env = createEnv({
  extends: [],
  server: {
    R2_ACCESS_KEY_ID: z.string(),
    R2_SECRET_ACCESS_KEY: z.string(),
    R2_ACCOUNT_ID: z.string(),
    R2_BUCKET_NAME: z.string().default("lightfast-media"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export const baseEnv = createEnv({
  extends: [],
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(4104),
    BASE_URL: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export const env = createEnv({
  extends: [render(), openAiEnv, falEnv, r2Env, baseEnv],
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
