import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { clerkEnvBase } from "@vendor/clerk/env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { env as dbEnv } from "@db/console/env";
import { githubEnv } from "@repo/console-octokit-github/env";

export const env = createEnv({
	extends: [vercel(), clerkEnvBase, dbEnv, sentryEnv, githubEnv],
	shared: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	server: {
		HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
		// No ANTHROPIC_API_KEY needed - Vercel AI Gateway uses VERCEL_OIDC_TOKEN

		/**
		 * Encryption key for storing sensitive data (OAuth tokens, API keys, etc.)
		 * Must be 32 bytes (64 hex characters or 44 base64 characters)
		 *
		 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
		 *
		 * REQUIRED in production, optional in development (will log warning)
		 */
		ENCRYPTION_KEY: z
			.string()
			.min(44)
			.refine(
				(key) => {
					// Validate hex (64 chars) or base64 (44 chars)
					const hexPattern = /^[0-9a-f]{64}$/i;
					const base64Pattern = /^[A-Za-z0-9+/]{43}=$/;
					return hexPattern.test(key) || base64Pattern.test(key);
				},
				{
					message:
						"ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)",
				},
			)
			.superRefine((key) => {
				// Warn in development if using a weak key
				if (process.env.NODE_ENV === "development") {
					if (
						key ===
						"0000000000000000000000000000000000000000000000000000000000000000"
					) {
						console.warn(
							"⚠️  WARNING: Using default ENCRYPTION_KEY in development. Generate a secure key for production!",
						);
					}
				}
			})
			.default(
				// Only allow default in development
				process.env.NODE_ENV === "development"
					? "0000000000000000000000000000000000000000000000000000000000000000"
					: "",
			),
	},
	client: {
		NEXT_PUBLIC_VERCEL_ENV: z
			.enum(["development", "preview", "production"])
			.default("development"),
		NEXT_PUBLIC_APP_URL: z.string().url().optional(),
	},
	experimental__runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
	},
	skipValidation:
		!!process.env.CI || process.env.npm_lifecycle_event === "lint",
	emptyStringAsUndefined: true,
});
