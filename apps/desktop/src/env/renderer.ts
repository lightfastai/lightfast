import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const rendererEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_LIGHTFAST_API_URL: z.string().url().default("http://localhost:3024"),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
  skipValidation: !!import.meta.env.VITE_SKIP_ENV_VALIDATION,
});
