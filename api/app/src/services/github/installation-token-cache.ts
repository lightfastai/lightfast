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
}): Promise<string> {
  const now = input.now ?? new Date();
  const cached = installationTokenCache.get(input.installationId);
  if (cached && cached.expiresAt - now.getTime() > REFRESH_SKEW_MS) {
    return cached.token;
  }

  const config = getGitHubAppConfig();
  const appJwt = await createGitHubAppJwt({
    appId: config.appId,
    privateKey: config.privateKey,
  });
  const token = await createGitHubInstallationToken({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    appJwt,
    installationId: input.installationId,
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
