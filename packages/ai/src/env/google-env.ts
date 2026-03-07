import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const googleEnv = createEnv({
  server: {
    GOOGLE_API_KEY: z.string().min(1),
    GOOGLE_PROJECT_ID: z.string().min(1),
    GOOGLE_AUTH_EMAIL: z.string().min(1),
    GOOGLE_AUTH_PRIVATE_KEY: z.string().min(1),
    GOOGLE_AUTH_PRIVATE_KEY_ID: z.string().min(1),
  },
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
});
