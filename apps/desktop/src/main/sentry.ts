import { randomUUID } from "node:crypto";
import {
  init,
  rewriteFramesIntegration,
} from "@vendor/observability/sentry-electron-main";
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
  // Sentry release versions reject `/`. Mirror the transform in
  // `apps/desktop/scripts/upload-sourcemaps.mjs` so the runtime release id
  // matches the uploaded sourcemaps; both must stay in sync.
  const releaseName = build.name.replace(/^@/, "").replace("/", "-");
  return {
    dsn,
    release: `${releaseName}@${build.version}+${build.buildNumber}`,
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
  init({
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
        signingMode: build.signingMode,
      },
    },
  });
  initialized = true;
}
