import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { vercelOAuthEnv } from "./oauth-env";

export { vercelOAuthEnv } from "./oauth-env";

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
