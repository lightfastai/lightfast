import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Core Vercel integration server vars — used by both console and connections.
 */
export const vercelOAuthEnv = createEnv({
	server: {
		VERCEL_INTEGRATION_SLUG: z.string().min(1),
		VERCEL_CLIENT_SECRET_ID: z.string().min(1),
		VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
		VERCEL_REDIRECT_URI: z.string().url().optional(),
	},
	experimental__runtimeEnv: {},
	skipValidation:
		!!process.env.SKIP_ENV_VALIDATION ||
		process.env.npm_lifecycle_event === "lint",
	emptyStringAsUndefined: true,
});
