import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const clientEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_LIGHTFAST_APP_URL: z.string().url(),
    VITE_TANSTACK_EXAMPLE_URL: z.string().url(),
  },
  server: {},
  runtimeEnv: {
    VITE_LIGHTFAST_APP_URL: import.meta.env.VITE_LIGHTFAST_APP_URL,
    VITE_TANSTACK_EXAMPLE_URL: import.meta.env.VITE_TANSTACK_EXAMPLE_URL,
  },
  skipValidation: import.meta.env.MODE === "test",
  emptyStringAsUndefined: true,
});
