import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { clerkEnvBase } from "@vendor/clerk/env";
import { env as upstashEnv } from "@vendor/upstash/env";

export const env = createEnv({
  extends: [
    vercel(),
    clerkEnvBase,
    upstashEnv,
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