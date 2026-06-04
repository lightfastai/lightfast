import "@tanstack/react-start/server-only";

import { createEnv } from "@t3-oss/env-core";
import { createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";

export const getServerEnv = createServerOnlyFn(() =>
  createEnv({
    clientPrefix: "VITE_",
    client: {},
    server: {
      NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
      SERVICE_JWT_SECRET: z.string().min(32),
    },
    runtimeEnv: {
      NODE_ENV: process.env.NODE_ENV,
      SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET,
    },
    skipValidation:
      !!process.env.SKIP_ENV_VALIDATION ||
      process.env.npm_lifecycle_event === "lint",
    emptyStringAsUndefined: true,
  })
);
