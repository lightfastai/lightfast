import { fileURLToPath } from "node:url";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { env } from "./src/env";
import { sentryClientDsn, sentryServerDsn } from "./src/env";

const host = process.env.HOST;
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

const sentryBuildEnvKeys = [
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
] as const;

function requireSentryBuildEnv(command: "build" | "serve") {
  if (command === "build") {
    for (const key of sentryBuildEnvKeys) {
      if (!env[key]) {
        throw new Error(
          `Missing required Sentry build environment variable: ${key}`
        );
      }
    }
    if (!sentryClientDsn) {
      throw new Error(
        "Missing required public Sentry DSN environment variable: VITE_SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN"
      );
    }
    if (!sentryServerDsn) {
      throw new Error(
        "Missing required server Sentry DSN environment variable: SENTRY_DSN, VITE_SENTRY_DSN, or NEXT_PUBLIC_SENTRY_DSN"
      );
    }
  }

  return {
    authToken: env.SENTRY_AUTH_TOKEN,
    org: env.SENTRY_ORG,
    project: env.SENTRY_PROJECT,
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    ...tanstackStart(),
    nitro(),
    react(),
    ...sentryTanstackStart(requireSentryBuildEnv(command)),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    "import.meta.env.VITE_LIGHTFAST_APP_URL": JSON.stringify(
      env.VITE_LIGHTFAST_APP_URL
    ),
    "import.meta.env.VITE_LIGHTFAST_PLATFORM_URL": JSON.stringify(
      env.VITE_LIGHTFAST_PLATFORM_URL
    ),
    "import.meta.env.VITE_LIGHTFAST_WWW_URL": JSON.stringify(
      env.VITE_LIGHTFAST_WWW_URL
    ),
    "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(sentryClientDsn ?? ""),
  },
  server: {
    ...(host ? { host } : {}),
    ...(port ? { port, strictPort: true } : {}),
  },
}));
