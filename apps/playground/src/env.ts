import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { braintrustEnv } from "@lightfast/core/v2/braintrust-env";
import { anthropicEnv } from "@repo/ai/anthropic-env";
import { browserbaseEnv } from "@repo/ai/browserbase-env";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as upstashEnv } from "@vendor/upstash/env";
import { env as storageEnv } from "@vendor/storage/env";

export const env = createEnv({
  extends: [
    vercel(),
    clerkEnvBase,
    upstashEnv,
    braintrustEnv,
    browserbaseEnv,
    anthropicEnv,
    storageEnv,
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {},
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },
});