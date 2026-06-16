import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const secureApiRequestEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    REQUEST_ID_SECRET: z.string().min(1).optional(),
  },
  runtimeEnv: {
    REQUEST_ID_SECRET: process.env.REQUEST_ID_SECRET,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
