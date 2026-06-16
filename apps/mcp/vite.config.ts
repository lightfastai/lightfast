import { fileURLToPath } from "node:url";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { env } from "./src/env";

const host = process.env.HOST;
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

const sentryClientDsn = env.VITE_SENTRY_DSN;
const sentryServerDsn = env.SENTRY_DSN ?? sentryClientDsn;

type SentryBuildOptions = NonNullable<
  Parameters<typeof sentryTanstackStart>[0]
>;

type SentryUploadEnv = Pick<
  typeof env,
  "SENTRY_AUTH_TOKEN" | "SENTRY_ORG" | "SENTRY_PROJECT"
>;

function hasSentrySourceMapUploadCredentials(sentryEnv: SentryUploadEnv) {
  return Boolean(
    sentryEnv.SENTRY_AUTH_TOKEN &&
      sentryEnv.SENTRY_ORG &&
      sentryEnv.SENTRY_PROJECT
  );
}

export function createSentryBuildOptions(
  command: "build" | "serve",
  sentryEnv: SentryUploadEnv = env,
  clientDsn = sentryClientDsn,
  serverDsn = sentryServerDsn
): SentryBuildOptions {
  const hasRequiredSentryBuildConfig = Boolean(
    clientDsn && serverDsn && hasSentrySourceMapUploadCredentials(sentryEnv)
  );

  if (command === "build" && !hasRequiredSentryBuildConfig) {
    return {
      org: undefined,
      project: undefined,
      sourcemaps: { disable: "disable-upload" },
    };
  }

  return {
    authToken: sentryEnv.SENTRY_AUTH_TOKEN,
    org: sentryEnv.SENTRY_ORG,
    project: sentryEnv.SENTRY_PROJECT,
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    ...tanstackStart(),
    nitro(),
    react(),
    ...sentryTanstackStart(createSentryBuildOptions(command)),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(sentryClientDsn ?? ""),
  },
  server: {
    ...(host ? { host } : {}),
    ...(port ? { port, strictPort: true } : {}),
  },
}));
