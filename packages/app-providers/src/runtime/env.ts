import { createEnv } from "@t3-oss/env-core";
import type { z } from "zod";

export function buildEnvGetter(
  envSchema: Record<string, z.ZodType>
): Record<string, string> {
  return createEnv({
    clientPrefix: "" as const,
    client: {},
    // SAFETY: envSchema values are always z.string() variants (env vars are strings).
    server: envSchema as Record<string, z.ZodType<string>>,
    runtimeEnv: Object.fromEntries(
      Object.keys(envSchema).map((k) => [k, process.env[k]])
    ),
    skipValidation:
      !!process.env.SKIP_ENV_VALIDATION ||
      process.env.npm_lifecycle_event === "lint",
    emptyStringAsUndefined: true,
  });
}
