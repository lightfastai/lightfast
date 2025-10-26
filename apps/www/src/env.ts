import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { posthogEnv } from "@vendor/analytics/env";
import { clerkEnvBase } from "@vendor/clerk/env";
import { env as emailEnv } from "@vendor/email/env";
import { env as inngestEnv } from "@vendor/inngest/env";
import { env as nextEnv } from "@vendor/next/env";
import { betterstackEnv } from "@vendor/observability/betterstack-env";
import { sentryEnv } from "@vendor/observability/sentry-env";
import { env as securityEnv } from "@vendor/security/env";
import { upstashEnv } from "@vendor/upstash/env";

export const env = createEnv({
	extends: [
		vercel(),
		clerkEnvBase,
		betterstackEnv,
		sentryEnv,
		securityEnv,
		emailEnv,
		inngestEnv,
		posthogEnv,
		nextEnv,
		upstashEnv,
	],
	shared: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	/**
	 * Specify your server-side environment variables schema here.
	 * This way you can ensure the app isn't built with invalid env vars.
	 */
	server: {
		RESEND_EARLY_ACCESS_AUDIENCE_ID: z.string().min(1),
		HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
		PORT: z.coerce.number().positive().optional().default(3000),
	},

	/**
	 * Specify your client-side environment variables schema here.
	 * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
	 */
	client: {
		NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]).default("development"),
	},
	/**
	 * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
	 */
	experimental__runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
	},
	// Server variables don't need to be in experimental__runtimeEnv
	skipValidation:
		!!process.env.CI || process.env.npm_lifecycle_event === "lint",

	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
