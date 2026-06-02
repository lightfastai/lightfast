import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import type { EmulatorManifest } from "./manifest";

export interface ResolvedEmulatorEnv {
  appOrigin: string;
  emulatorOrigin?: string;
  host: string;
  port: number;
}

function readOptionalUrl(
  value: string | undefined,
  skipValidation: boolean
): string | undefined {
  const normalized = value === "" ? undefined : value;
  if (normalized === undefined || skipValidation) {
    return normalized;
  }
  return z.string().url().parse(normalized);
}

export function createEmulatorEnv(
  manifest: EmulatorManifest,
  runtimeEnv: NodeJS.ProcessEnv = process.env
): ResolvedEmulatorEnv {
  const skipValidation =
    !!runtimeEnv.SKIP_ENV_VALIDATION ||
    runtimeEnv.npm_lifecycle_event === "lint";

  const env = createEnv({
    emptyStringAsUndefined: true,
    runtimeEnv: {
      HOST: runtimeEnv.HOST,
      LIGHTFAST_APP_ORIGIN: runtimeEnv.LIGHTFAST_APP_ORIGIN,
      PORT: runtimeEnv.PORT,
      PORTLESS_URL: runtimeEnv.PORTLESS_URL,
    },
    server: {
      HOST: z.string().min(1).default("127.0.0.1"),
      LIGHTFAST_APP_ORIGIN: z
        .string()
        .url()
        .default("https://lightfast.localhost"),
      PORT: z.coerce.number().int().min(1).max(65_535).default(manifest.port),
      PORTLESS_URL: z.string().url().optional(),
    },
    skipValidation,
  });

  return {
    appOrigin: env.LIGHTFAST_APP_ORIGIN,
    emulatorOrigin:
      readOptionalUrl(runtimeEnv[manifest.originEnvVar], skipValidation) ??
      env.PORTLESS_URL,
    host: env.HOST,
    port: env.PORT,
  };
}
