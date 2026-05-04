import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const dbEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  server: {
    DATABASE_HOST: z
      .string()
      .min(1)
      .refine(
        (v) => !(v.startsWith("pscale_pw_") || v.startsWith("pscale_api_")),
        {
          message: "DATABASE_HOST should be a hostname, not a credential",
        }
      ),
    DATABASE_PORT: z.coerce.number().int().positive().optional(),
    DATABASE_USERNAME: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_NAME: z.string().min(1).optional(),
  },
  runtimeEnv: {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PORT: process.env.DATABASE_PORT,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_NAME: process.env.DATABASE_NAME,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
