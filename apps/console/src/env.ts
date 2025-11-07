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
