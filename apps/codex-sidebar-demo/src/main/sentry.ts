import * as Sentry from "@sentry/electron/main";
import { getBuildInfo, getRuntimeEnv } from "./build-info";

export interface SentryInitOptions {
  dsn: string;
  enabled: boolean;
  environment: string;
  release: string;
}

export function getSentryInitOptions(): SentryInitOptions {
  const build = getBuildInfo();
  const env = getRuntimeEnv();
  const dsn = env.SENTRY_DSN ?? "";
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
  Sentry.init({
    dsn: options.dsn,
    release: options.release,
    environment: options.environment,
  });
  initialized = true;
}
