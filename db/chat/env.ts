import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Database environment variables for chat (PlanetScale MySQL)
 *
 * Chat uses PlanetScale MySQL where usernames are random strings,
 * unlike PlanetScale PostgreSQL which uses pscale_api_ prefixed credentials.
 */
export const env = createEnv({
  shared: {},
  server: {
    DATABASE_HOST: z
      .string()
      .min(1)
      .refine((v) => !v.startsWith("pscale_pw_") && !v.startsWith("pscale_api_"), {
        message: "DATABASE_HOST should be a hostname, not a credential",
      }),
    DATABASE_USERNAME: z.string().min(1),
    DATABASE_PASSWORD: z.string().startsWith("pscale_pw_"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
