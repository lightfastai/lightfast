import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/electron/main";
import { rewriteFramesIntegration } from "@sentry/electron/main";
import { app } from "electron";
import { mainEnv } from "../env/main";
import { getBuildInfo } from "./build-info";

export interface SentryInitOptions {
  dsn: string;
  enabled: boolean;
  environment: string;
  release: string;
}

const SESSION_ID = randomUUID();

export function getSentryInitOptions(): SentryInitOptions {
  const build = getBuildInfo();
  const dsn = mainEnv.SENTRY_DSN ?? "";
  return {
    dsn,
    release: `${build.name}@${build.version}+${build.buildNumber}`,
    environment: build.buildFlavor,
    enabled: Boolean(dsn) && build.buildFlavor !== "dev",
  };
}

let initialized = false;

export function initSentry(): void {
  if (initialized) {
    return;
  }
  const options = getSentryInitOptions();
  if (!options.enabled) {
    return;
  }
  const build = getBuildInfo();
  Sentry.init({
    dsn: options.dsn,
    release: options.release,
    environment: options.environment,
    dist: build.buildNumber,
    integrations: [
      rewriteFramesIntegration({ root: app.getAppPath(), prefix: "app:///" }),
    ],
    initialScope: {
      tags: {
        sessionId: SESSION_ID,
        bundle: "electron",
        host: "app",
      },
    },
  });
  initialized = true;
}
