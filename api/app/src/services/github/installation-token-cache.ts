import {
  createGitHubAppJwt,
  createGitHubInstallationToken,
} from "@repo/github-app-node";

import { getGitHubAppConfig } from "./config";

const REFRESH_SKEW_MS = 5 * 60 * 1000;

const installationTokenCache = new Map<
  string,
  { expiresAt: number; token: string }
>();

export async function getCachedGitHubInstallationToken(input: {
  installationId: string;
  now?: Date;
  signal?: AbortSignal;
}): Promise<string> {
  input.signal?.throwIfAborted();
  const now = input.now ?? new Date();
  const cached = installationTokenCache.get(input.installationId);
  if (cached && cached.expiresAt - now.getTime() > REFRESH_SKEW_MS) {
    return cached.token;
  }

  const config = getGitHubAppConfig();
  input.signal?.throwIfAborted();
  const appJwt = await createGitHubAppJwt({
    appId: config.appId,
    privateKey: config.privateKey,
  });
  input.signal?.throwIfAborted();
  const token = await createGitHubInstallationToken({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    appJwt,
    installationId: input.installationId,
    signal: input.signal,
  });
  installationTokenCache.set(input.installationId, {
    expiresAt: toMillis(token.expiresAt),
    token: token.token,
  });
  return token.token;
}

export function clearGitHubInstallationTokenCacheForTests(): void {
  installationTokenCache.clear();
}

function toMillis(value: string | Date | number): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) {
    throw new Error("GitHub installation token expiry was invalid.");
  }
  return millis;
}
