import { Octokit } from "octokit";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import type { App } from "octokit";

/**
 * Throttled Octokit with rate limit handling and retries
 *
 * Implements automatic retry with exponential backoff for rate limits
 * and handles both primary and secondary rate limits.
 */

const ThrottledOctokit = Octokit.plugin(throttling, retry);

/**
 * Create a throttled Octokit instance with rate limit handling
 *
 * @param auth - GitHub access token
 * @returns Octokit instance with throttling and retry plugins
 */
export function createThrottledOctokit(auth: string) {
	return new ThrottledOctokit({
		auth,
		throttle: {
			onRateLimit: (
				retryAfter: number,
				options: any,
				octokit: any,
				retryCount: number
			) => {
				octokit.log.warn(
					`Rate limit exhausted for ${options.method} ${options.url}`
				);

				// Retry twice after hitting rate limit
				if (retryCount <= 2) {
					console.log(`Retrying after ${retryAfter}s (attempt ${retryCount + 1}/3)`);
					return true;
				}

				// Give up after 2 retries
				console.error(`Rate limit exhausted, giving up after ${retryCount} retries`);
				return false;
			},
			onSecondaryRateLimit: (
				retryAfter: number,
				options: any,
				octokit: any
			) => {
				// Don't automatically retry secondary rate limits
				octokit.log.warn(
					`Secondary rate limit hit for ${options.method} ${options.url}. Please wait ${retryAfter}s before retrying.`
				);

				// Never auto-retry secondary rate limits
				return false;
			},
		},
		retry: {
			doNotRetry: [400, 401, 403, 404, 422], // Don't retry client errors except 403 (which might be rate limit)
		},
	});
}

/**
 * Get a throttled installation Octokit instance
 *
 * @param app - GitHub App instance
 * @param installationId - The GitHub App installation ID
 * @returns Throttled Octokit instance authenticated as the installation
 */
export async function getThrottledInstallationOctokit(
	app: App,
	installationId: number
) {
	const { token } = await app.octokit.auth({
		type: "installation",
		installationId,
	}) as { token: string };

	return createThrottledOctokit(token);
}

/**
 * Check rate limit status
 *
 * @param octokit - Octokit instance (throttled or regular)
 * @returns Rate limit information
 */
export async function checkRateLimit(octokit: InstanceType<typeof ThrottledOctokit>) {
	const { data } = await octokit.request("GET /rate_limit");
	const { remaining, limit, reset } = data.rate;

	const percentUsed = ((limit - remaining) / limit) * 100;
	const resetTime = new Date(reset * 1000);

	console.log({
		event: "github.rate_limit",
		remaining,
		limit,
		percentUsed: Math.round(percentUsed * 100) / 100,
		resetTime: resetTime.toISOString(),
	});

	// Warn if getting low
	if (remaining < 100) {
		console.warn(
			`[RateLimit] Low quota: ${remaining}/${limit} remaining, resets at ${resetTime.toISOString()}`
		);
	}

	// Reject if critically low (reserve some quota)
	if (remaining < 50) {
		throw new Error(
			`Rate limit too low (${remaining}). Wait until ${resetTime.toISOString()}`
		);
	}

	return { remaining, limit, reset, resetTime };
}
