import { createEnv } from "@t3-oss/env-core";
import type { z } from "zod";
import { PROVIDERS } from "./registry";

const mergedSchema = Object.values(PROVIDERS).reduce<Record<string, z.ZodType>>(
  (acc, p) => Object.assign(acc, p.envSchema),
  {}
);

export const providerEnv = createEnv({
  clientPrefix: "" as const,
  client: {},
  // SAFETY: envSchema values are always z.string() variants (env vars are strings).
  server: mergedSchema as Record<string, z.ZodType<string>>,
  runtimeEnv: Object.fromEntries(
    Object.keys(mergedSchema).map((k) => [k, process.env[k]])
  ),
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
