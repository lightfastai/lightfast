import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const clientEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_LIGHTFAST_APP_URL: z.string().url(),
    VITE_LIGHTFAST_PLATFORM_URL: z.string().url(),
    VITE_LIGHTFAST_WWW_URL: z.string().url(),
    VITE_WWW_START_URL: z.string().url(),
  },
  server: {},
  runtimeEnv: {
    VITE_LIGHTFAST_APP_URL: import.meta.env.VITE_LIGHTFAST_APP_URL,
    VITE_LIGHTFAST_PLATFORM_URL: import.meta.env.VITE_LIGHTFAST_PLATFORM_URL,
    VITE_LIGHTFAST_WWW_URL: import.meta.env.VITE_LIGHTFAST_WWW_URL,
    VITE_WWW_START_URL: import.meta.env.VITE_WWW_START_URL,
  },
  skipValidation: import.meta.env.MODE === "test",
  emptyStringAsUndefined: true,
});
