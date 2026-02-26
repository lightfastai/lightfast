import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Core GitHub App OAuth vars — used by both console and connections.
 */
export const githubOAuthEnv = createEnv({
	server: {
		GITHUB_APP_ID: z.string().min(1),
		GITHUB_APP_PRIVATE_KEY: z.string().min(1),
		GITHUB_APP_SLUG: z.string().min(1),
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),
	},
	experimental__runtimeEnv: {},
	skipValidation:
		!!process.env.SKIP_ENV_VALIDATION ||
		process.env.npm_lifecycle_event === "lint",
	emptyStringAsUndefined: true,
});

/**
 * Full GitHub env with webhook + client vars — used by console.
 */
export const githubEnv = createEnv({
	extends: [githubOAuthEnv],
	server: {
		GITHUB_WEBHOOK_SECRET: z.string().min(32),
	},
	client: {
		NEXT_PUBLIC_GITHUB_APP_SLUG: z.string().min(1),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_GITHUB_APP_SLUG: process.env.NEXT_PUBLIC_GITHUB_APP_SLUG,
	},
	skipValidation:
		!!process.env.SKIP_ENV_VALIDATION ||
		process.env.npm_lifecycle_event === "lint",
	emptyStringAsUndefined: true,
});
