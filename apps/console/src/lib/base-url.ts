import { env } from "~/env";

/**
 * Get the base URL for the console application
 *
 * This is used primarily for OAuth callbacks and webhooks where we need
 * to provide an absolute URL back to our application.
 *
 * Uses Vercel-provided environment variables to determine the correct URL:
 * - Production: https://lightfast.ai (microfrontends routing)
 * - Preview: https://{VERCEL_URL}
 * - Development: http://localhost:4107
 *
 * @returns The base URL for the console app
 *
 * @example
 * ```ts
 * import { getConsoleBaseUrl } from "~/lib/base-url";
 *
 * const baseUrl = getConsoleBaseUrl();
 * const callbackUrl = `${baseUrl}/api/github/user-authorized`;
 * ```
 */
export function getConsoleBaseUrl(): string {
	switch (env.NEXT_PUBLIC_VERCEL_ENV) {
		case "production":
			// Console is served at lightfast.ai (microfrontends)
			return "https://lightfast.ai";

		case "preview":
			// Vercel provides VERCEL_URL for preview deployments
			if (process.env.VERCEL_URL) {
				return `https://${process.env.VERCEL_URL}`;
			}
			// Fallback if VERCEL_URL is not available (shouldn't happen on Vercel)
			return "https://lightfast.ai";

		case "development":
		default: {
			// Use PORT env var if set, otherwise default to 4107
			// (see dual.config.yml and microfrontends.json for port configuration)
			const port = process.env.PORT ?? "4107";
			return `http://localhost:${port}`;
		}
	}
}
