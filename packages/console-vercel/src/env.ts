import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { vendorApiKey } from "@repo/console-validation";

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
		// Vercel Integration Slug (integration name in marketplace URL)
		// Used for: Marketplace install URL (https://vercel.com/integrations/{slug}/new)
		// Example: "lightfast" (production) or "lightfast-dev" (development)
		VERCEL_INTEGRATION_SLUG: z.string().min(1),

		// Vercel Integration OAuth & Webhooks
		// NOTE: Integration webhooks use the CLIENT_INTEGRATION_SECRET for signature verification,
		// not a separate webhook secret (per Vercel docs)
		VERCEL_CLIENT_SECRET_ID: vendorApiKey("oac_"),
		VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
		// Redirect URI for OAuth token exchange - must match Integration Console config
		// In local dev with ngrok: https://your-ngrok-url.ngrok-free.app/api/vercel/callback
		// In production: https://lightfast.ai/api/vercel/callback
		VERCEL_REDIRECT_URI: z.string().url().optional(),
	},
	client: {
		// Vercel Integration Slug (public - visible in URLs anyway)
		// Used for: Client-side Vercel integration/permission links
		// Example: "lightfast" (production) or "lightfast-dev" (development)
		NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG: z.string().min(1),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG: process.env.NEXT_PUBLIC_VERCEL_INTEGRATION_SLUG,
	},
	skipValidation:
		!!process.env.SKIP_ENV_VALIDATION ||
		process.env.npm_lifecycle_event === "lint",
	emptyStringAsUndefined: true,
});
