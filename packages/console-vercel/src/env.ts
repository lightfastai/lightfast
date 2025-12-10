import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Vercel Integration Environment Variables
 *
 * Centralized configuration for Vercel integration OAuth and webhooks.
 * Used by both apps/console and api/console.
 *
 * This package provides Vercel-specific environment configuration
 * for the Console application's Vercel integration.
 */
export const vercelEnv = createEnv({
	shared: {},
	server: {
		// Vercel Integration OAuth & Webhooks
		// NOTE: Integration webhooks use the CLIENT_INTEGRATION_SECRET for signature verification,
		// not a separate webhook secret (per Vercel docs)
		VERCEL_CLIENT_SECRET_ID: z.string().min(1).startsWith("oac_"),
		VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
		// Redirect URI for OAuth token exchange - must match Integration Console config
		// In local dev with ngrok: https://your-ngrok-url.ngrok-free.app/api/vercel/callback
		// In production: https://lightfast.ai/api/vercel/callback
		VERCEL_REDIRECT_URI: z.string().url().optional(),
	},
	client: {},
	experimental__runtimeEnv: {},
	skipValidation:
		!!process.env.CI ||
		process.env.npm_lifecycle_event === "lint" ||
		process.env.SKIP_ENV_VALIDATION === "true",
	emptyStringAsUndefined: true,
});
