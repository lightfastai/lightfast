/**
 * Module-level provider configs — built once at startup from validated env vars.
 *
 * Ported from apps/gateway/src/routes/connections.ts (lines 44–64).
 * Uses the memory app's base URL for OAuth callbacks instead of the gateway.
 */
import type { RuntimeConfig } from "@repo/console-providers";
import { PROVIDERS } from "@repo/console-providers";
import { env } from "../env.js";

/**
 * Memory service base URL (self).
 *
 * In the gateway this resolved to `gatewayBaseUrl` (e.g. https://<url>/services).
 * Here we resolve to the memory app's base URL so that OAuth callback URLs
 * point to the memory service's route handlers.
 */
const memoryBaseUrl = (() => {
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
})();

const runtime: RuntimeConfig = { callbackBaseUrl: memoryBaseUrl };

/**
 * Configs keyed by provider name.
 *
 * SAFETY: env is validated by @t3-oss/env-nextjs at startup; the memory API's combined
 * env object is structurally compatible with Record<string, string> (all env vars
 * are strings). The intersection type from createEnv() cannot be expressed generically.
 * Optional providers return null from createConfig when their env vars are absent —
 * they are excluded here and will return "unknown_provider" on any request.
 */
export const providerConfigs: Record<string, unknown> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .map(
      ([name, p]) =>
        [
          name,
          p.createConfig(env as unknown as Record<string, string>, runtime),
        ] as const
    )
    .filter(([, config]) => config !== null)
);
