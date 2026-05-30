import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export interface GitHubEmulatorRuntimeEnv {
  appOrigin: string;
  emulatorOrigin?: string;
  host: string;
  port: number;
}

export function createGitHubEmulatorRuntimeEnv(
  runtimeEnv: NodeJS.ProcessEnv = process.env
): GitHubEmulatorRuntimeEnv {
  const env = createEnv({
    server: {
      GITHUB_EMULATOR_ORIGIN: z.string().url().optional(),
      HOST: z.string().min(1).default("127.0.0.1"),
      LIGHTFAST_APP_ORIGIN: z
        .string()
        .url()
        .default("https://lightfast.localhost"),
      PORT: z.coerce.number().int().min(1).max(65_535).default(4567),
      PORTLESS_URL: z.string().url().optional(),
    },
    runtimeEnv: {
      GITHUB_EMULATOR_ORIGIN: runtimeEnv.GITHUB_EMULATOR_ORIGIN,
      HOST: runtimeEnv.HOST,
      LIGHTFAST_APP_ORIGIN: runtimeEnv.LIGHTFAST_APP_ORIGIN,
      PORT: runtimeEnv.PORT,
      PORTLESS_URL: runtimeEnv.PORTLESS_URL,
    },
    emptyStringAsUndefined: true,
    skipValidation:
      !!runtimeEnv.SKIP_ENV_VALIDATION ||
      runtimeEnv.npm_lifecycle_event === "lint",
  });

  return {
    appOrigin: env.LIGHTFAST_APP_ORIGIN,
    emulatorOrigin: env.GITHUB_EMULATOR_ORIGIN ?? env.PORTLESS_URL,
    host: env.HOST,
    port: env.PORT,
  };
}
