import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const host = process.env.HOST;
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

export const buildEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_LIGHTFAST_APP_URL: z.string().url(),
    VITE_TANSTACK_EXAMPLE_URL: z.string().url(),
  },
  server: {
    SERVICE_JWT_SECRET: z.string().min(32),
  },
  runtimeEnv: {
    VITE_LIGHTFAST_APP_URL:
      process.env.VITE_LIGHTFAST_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://lightfast.ai",
    VITE_TANSTACK_EXAMPLE_URL:
      process.env.VITE_TANSTACK_EXAMPLE_URL ??
      process.env.PORTLESS_URL ??
      `http://${host || "localhost"}:${port ? String(port) : "5173"}`,
    SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET,
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
