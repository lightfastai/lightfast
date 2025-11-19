import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * GitHub App Environment Variables
 *
 * Centralized configuration for GitHub App authentication and webhooks.
 * Used by both apps/console and api/console.
 *
 * This package provides GitHub-specific utilities and environment configuration
 * for the Console application's GitHub integration.
 */
export const githubEnv = createEnv({
	shared: {},
	server: {
		// GitHub App Installation Authentication
		// Used for: Repository access, content fetching, webhook verification
		GITHUB_APP_ID: z.string().min(1),
		GITHUB_APP_PRIVATE_KEY: z.string().min(1),

		// GitHub App Slug (app name in URL)
		// Used for: Installation URL (https://github.com/apps/{slug}/installations/new)
		// Example: "lightfast-console" or "lightfast-console-dev"
		GITHUB_APP_SLUG: z.string().min(1),

		// GitHub OAuth (for user authorization)
		// Used for: User authentication flow, organization installation listing
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),

		// GitHub Webhooks
		// Used for: Webhook signature verification (push, installation events)
		GITHUB_WEBHOOK_SECRET: z.string().min(32),
	},
	client: {},
	experimental__runtimeEnv: {},
	skipValidation:
		!!process.env.CI ||
		process.env.npm_lifecycle_event === "lint" ||
		process.env.SKIP_ENV_VALIDATION === "true",
	emptyStringAsUndefined: true,
});
