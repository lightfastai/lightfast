/**
 * Client-side base URL utility.
 *
 * Uses window.location.origin on client, environment variables on server.
 */

/**
 * Creates a base URL based on the current environment.
 *
 * IMPORTANT: Returns custom domain (www.lightfast.ai) in production, not Vercel URL.
 * This ensures same-origin requests for PostHog proxy (/ingest rewrites).
 *
 * @returns {string} The complete base URL for the current environment
 */
export const createBaseUrl = (): string => {
  // Client-side: use window.location.origin for correct same-origin requests
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side: use environment variables
  // eslint-disable-next-line no-restricted-properties
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  // eslint-disable-next-line no-restricted-properties
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;

  // Production: Use custom domain for same-origin PostHog proxy
  if (vercelEnv === "production") {
    return "https://www.lightfast.ai";
  }

  // Preview on Vercel
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  // Local development fallback
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing, no-restricted-properties
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
};
