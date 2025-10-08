import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { clerkEnvBase } from "@vendor/clerk/env";
import { sentryEnv } from "@vendor/observability/sentry-env";

export const env = createEnv({
	extends: [vercel(), clerkEnvBase, sentryEnv],
	shared: {},
	server: {
		// GitHub App credentials (required for API operations)
		GITHUB_APP_ID: z.string().min(1),
		GITHUB_APP_PRIVATE_KEY: z.string().min(1),
	},
	client: {},
	experimental__runtimeEnv: {},
	skipValidation:
		!!process.env.CI || process.env.npm_lifecycle_event === "lint",
	emptyStringAsUndefined: true,
});
