import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const sentryIntegrationEnv = createEnv({
	server: {
		SENTRY_CLIENT_ID: z.string().min(1).optional(),
		SENTRY_CLIENT_SECRET: z.string().min(1).optional(),
	},
	experimental__runtimeEnv: {},
	skipValidation:
		!!process.env.SKIP_ENV_VALIDATION ||
		process.env.npm_lifecycle_event === "lint",
	emptyStringAsUndefined: true,
});
