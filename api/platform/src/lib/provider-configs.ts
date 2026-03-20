/**
 * Lazy-initialized provider configs — built on first access from validated env vars.
 *
 * Ported from apps/gateway/src/routes/connections.ts (lines 44–64).
 * Uses the memory app's base URL for OAuth callbacks instead of the gateway.
 *
 * IMPORTANT: Lazy initialization prevents build-time crashes when env vars
 * are not yet available during `next build` static analysis.
 */
import type { RuntimeConfig } from "@repo/app-providers";
import { PROVIDERS } from "@repo/app-providers";
import { env } from "../env";

/**
 * Memory service base URL (self).
 *
 * In the gateway this resolved to `gatewayBaseUrl` (e.g. https://<url>/services).
 * Here we resolve to the memory app's base URL so that OAuth callback URLs
 * point to the memory service's route handlers.
 */
function getMemoryBaseUrl(): string {
  const vercelUrl = process.env.VERCEL_URL;
  const vercelEnv = process.env.VERCEL_ENV;
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (vercelEnv === "preview" && vercelUrl) {
    return `https://${vercelUrl}`;
  }

  if (productionUrl) {
    return `https://${productionUrl}`;
  }

  return "http://localhost:4112";
}

let _providerConfigs: Record<string, unknown> | null = null;

/**
 * Configs keyed by provider name — built on first access.
 *
 * Optional providers return null from createConfig when their env vars are absent —
 * they are excluded and will return "unknown_provider" on any request.
 */
export function getProviderConfigs(): Record<string, unknown> {
  if (!_providerConfigs) {
    const runtime: RuntimeConfig = { callbackBaseUrl: getMemoryBaseUrl() };
    _providerConfigs = Object.fromEntries(
      Object.entries(PROVIDERS)
        .map(
          ([name, p]) =>
            [
              name,
              p.createConfig(
                env as unknown as Record<string, string>,
                runtime
              ),
            ] as const
        )
        .filter(([, config]) => config !== null)
    );
  }
  return _providerConfigs;
}

/**
 * @deprecated Use getProviderConfigs() instead. This is a compatibility alias
 * that lazily initializes on first property access.
 */
export const providerConfigs: Record<string, unknown> = new Proxy(
  {} as Record<string, unknown>,
  {
    get(_target, prop) {
      return getProviderConfigs()[prop as string];
    },
    has(_target, prop) {
      return prop in getProviderConfigs();
    },
    ownKeys() {
      return Object.keys(getProviderConfigs());
    },
    getOwnPropertyDescriptor(_target, prop) {
      const configs = getProviderConfigs();
      if (prop in configs) {
        return {
          configurable: true,
          enumerable: true,
          value: configs[prop as string],
        };
      }
      return undefined;
    },
  }
);
