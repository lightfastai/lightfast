import { env } from "../env";

/**
 * Gateway base URL derived from Vercel system environment variables.
 *
 * - Production: https://{VERCEL_PROJECT_PRODUCTION_URL} (gateway.lightfast.ai)
 * - Preview:    https://{VERCEL_URL} (deployment-specific)
 * - Local:      http://localhost:4108
 */
export const gatewayBaseUrl = (() => {
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "http://localhost:4108";
})();
