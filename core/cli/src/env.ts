import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function createCliEnv(runtimeEnv: NodeJS.ProcessEnv = process.env) {
  return createEnv({
    server: {
      LIGHTFAST_APP_URL: z.string().url().optional(),
      LIGHTFAST_CLI_CONFIG_DIR: z.string().min(1).optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

export const cliEnv = createCliEnv();
