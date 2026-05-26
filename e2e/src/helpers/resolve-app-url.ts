import { execFileSync } from "node:child_process";

import { normalizeUrl, trimTrailingSlash } from "./env";

const LIGHTFAST_APP_PORTLESS_NAME = "app.lightfast";

type Env = Record<string, string | undefined>;

export interface ResolveE2EAppUrlOptions {
  env?: Env;
  getPortlessUrl?: (name: string) => string | undefined;
}

export function resolveE2EAppUrl(
  options: ResolveE2EAppUrlOptions = {}
): string {
  const env = options.env ?? process.env;
  const explicitAppUrl = env.LIGHTFAST_E2E_APP_URL?.trim();
  if (explicitAppUrl) {
    return normalizeUrl(explicitAppUrl, "LIGHTFAST_E2E_APP_URL");
  }

  return trimTrailingSlash(
    options.getPortlessUrl?.(LIGHTFAST_APP_PORTLESS_NAME) ??
      readPortlessUrl(LIGHTFAST_APP_PORTLESS_NAME)
  );
}

export function resolveE2EApiBase(
  options: ResolveE2EAppUrlOptions = {}
): string {
  const env = options.env ?? process.env;
  const explicitApiBase = env.LIGHTFAST_SIGNAL_API_BASE?.trim();
  if (explicitApiBase) {
    return normalizeUrl(explicitApiBase, "LIGHTFAST_SIGNAL_API_BASE");
  }

  return `${resolveE2EAppUrl(options)}/api/v1`;
}

function readPortlessUrl(name: string): string {
  return execFileSync("portless", ["get", name], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
