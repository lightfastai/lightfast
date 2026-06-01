import {
  createGitHubAppJwt,
  createGitHubInstallationToken,
} from "@repo/github-app-node";

import { getGitHubAppConfig } from "./config";

const REFRESH_SKEW_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;

const installationTokenCache = new Map<
  string,
  { expiresAt: number; token: string }
>();
const pendingInstallationTokens = new Map<
  string,
  Promise<{ expiresAt: number; token: string }>
>();

export async function getCachedGitHubInstallationToken(input: {
  installationId: string;
  now?: Date;
  signal?: AbortSignal;
}): Promise<string> {
  input.signal?.throwIfAborted();
  const now = input.now ?? new Date();
  const config = getGitHubAppConfig();
  const cacheKey = createInstallationTokenCacheKey({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    appId: config.appId,
    installationId: input.installationId,
  });
  pruneExpiredInstallationTokens(now.getTime());
  const cached = installationTokenCache.get(cacheKey);
  if (cached && cached.expiresAt - now.getTime() > REFRESH_SKEW_MS) {
    return cached.token;
  }
  if (cached) {
    installationTokenCache.delete(cacheKey);
  }

  const pending = pendingInstallationTokens.get(cacheKey);
  if (pending) {
    input.signal?.throwIfAborted();
    const token = await pending;
    input.signal?.throwIfAborted();
    return token.token;
  }

  const pendingToken = mintGitHubInstallationToken({
    config,
    installationId: input.installationId,
    signal: input.signal,
  });
  setBoundedMapValue(pendingInstallationTokens, cacheKey, pendingToken);
  try {
    const token = await pendingToken;
    setBoundedMapValue(installationTokenCache, cacheKey, token);
    return token.token;
  } finally {
    pendingInstallationTokens.delete(cacheKey);
  }
}

async function mintGitHubInstallationToken(input: {
  config: ReturnType<typeof getGitHubAppConfig>;
  installationId: string;
  signal?: AbortSignal;
}): Promise<{ expiresAt: number; token: string }> {
  input.signal?.throwIfAborted();
  const appJwt = await createGitHubAppJwt({
    appId: input.config.appId,
    privateKey: input.config.privateKey,
  });
  input.signal?.throwIfAborted();
  const token = await createGitHubInstallationToken({
    apiBaseUrl: input.config.endpoints.apiBaseUrl,
    apiVersion: input.config.apiVersion,
    appJwt,
    installationId: input.installationId,
    signal: input.signal,
  });
  return {
    expiresAt: toMillis(token.expiresAt),
    token: token.token,
  };
}

export function clearGitHubInstallationTokenCacheForTests(): void {
  installationTokenCache.clear();
  pendingInstallationTokens.clear();
}

function createInstallationTokenCacheKey(input: {
  apiBaseUrl: string;
  apiVersion: string;
  appId: string;
  installationId: string;
}): string {
  return [
    input.apiBaseUrl,
    input.apiVersion,
    input.appId,
    input.installationId,
  ].join(":");
}

function pruneExpiredInstallationTokens(nowMs: number): void {
  for (const [key, cached] of installationTokenCache) {
    if (cached.expiresAt - nowMs <= REFRESH_SKEW_MS) {
      installationTokenCache.delete(key);
    }
  }
}

function setBoundedMapValue<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  while (map.size > MAX_CACHE_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    map.delete(oldestKey);
  }
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
