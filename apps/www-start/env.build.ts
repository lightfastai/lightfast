import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const host = process.env.HOST;
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

export const buildEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_LIGHTFAST_APP_URL: z.string().url(),
    VITE_LIGHTFAST_PLATFORM_URL: z.string().url(),
    VITE_LIGHTFAST_WWW_URL: z.string().url(),
    VITE_WWW_START_URL: z.string().url(),
  },
  server: {},
  runtimeEnv: {
    VITE_LIGHTFAST_APP_URL:
      process.env.VITE_LIGHTFAST_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://lightfast.ai",
    VITE_LIGHTFAST_PLATFORM_URL:
      process.env.VITE_LIGHTFAST_PLATFORM_URL ??
      process.env.NEXT_PUBLIC_PLATFORM_URL ??
      "https://lightfast-platform.vercel.app",
    VITE_LIGHTFAST_WWW_URL:
      process.env.VITE_LIGHTFAST_WWW_URL ??
      process.env.NEXT_PUBLIC_WWW_URL ??
      "https://lightfast.ai",
    VITE_WWW_START_URL:
      process.env.VITE_WWW_START_URL ??
      process.env.PORTLESS_URL ??
      `http://${host || "localhost"}:${port ? String(port) : "5173"}`,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});

export const devServer = {
  host,
  port,
};
