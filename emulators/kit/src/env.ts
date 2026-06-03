import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import type { EmulatorManifest } from "./manifest";

export interface ResolvedEmulatorEnv {
  callbackUrl?: string;
  host: string;
  port: number;
  publicOrigin?: string;
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
      CALLBACK_URL: runtimeEnv.CALLBACK_URL,
      HOST: runtimeEnv.HOST,
      PORT: runtimeEnv.PORT,
      PUBLIC_ORIGIN: runtimeEnv.PUBLIC_ORIGIN,
    },
    server: {
      CALLBACK_URL: z.string().url().optional(),
      HOST: z.string().min(1).default("127.0.0.1"),
      PORT: z.coerce.number().int().min(1).max(65_535).default(manifest.port),
      PUBLIC_ORIGIN: z.string().url().optional(),
    },
    skipValidation,
  });

  return {
    callbackUrl: readOptionalUrl(env.CALLBACK_URL, skipValidation),
    host: env.HOST,
    port: env.PORT,
    publicOrigin: readOptionalUrl(env.PUBLIC_ORIGIN, skipValidation),
  };
}
