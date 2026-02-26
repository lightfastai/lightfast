import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Core Vercel integration server vars — used by both console and connections.
 */
export const vercelOAuthEnv = createEnv({
	server: {
		VERCEL_INTEGRATION_SLUG: z.string().min(1),
		VERCEL_CLIENT_ID: z.string().min(1).startsWith("oac_"),
		VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
		VERCEL_REDIRECT_URI: z.string().url().optional(),
	},
	experimental__runtimeEnv: {},
	skipValidation:
		!!process.env.SKIP_ENV_VALIDATION ||
		process.env.npm_lifecycle_event === "lint",
	emptyStringAsUndefined: true,
});

/**
 * Full Vercel env with client vars — used by console.
 */
export const vercelEnv = createEnv({
	extends: [vercelOAuthEnv],
	client: {
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
