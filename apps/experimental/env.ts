import { env as aiEnv } from "@lightfast/ai/env";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Extend from T3-OSS Vercel preset and AI package env
	 */
	extends: [vercel(), aiEnv],

	/**
	 * Specify your server-side environment variables schema here.
	 * This way you can ensure the app isn't built with invalid env vars.
	 */
	server: {
		// Redis & KV Store (additional to AI package)
		REDIS_URL: z.string().url(),
		KV_URL: z.string().url(),
		KV_REST_API_READ_ONLY_TOKEN: z.string().min(1),

		// Clerk Authentication
		CLERK_SECRET_KEY: z.string().min(1),
	},

	/**
	 * Specify your client-side environment variables schema here.
	 * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
	 */
	client: {
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
		NEXT_PUBLIC_VIRTUOSO_LICENSE_KEY: z.string().min(1).optional(),
		NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		// Redis & KV Store (additional to AI package)
		REDIS_URL: process.env.REDIS_URL,
		KV_URL: process.env.KV_URL,
		KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN,

		// Clerk Authentication
		CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,

		// Client
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
		NEXT_PUBLIC_VIRTUOSO_LICENSE_KEY: process.env.NEXT_PUBLIC_VIRTUOSO_LICENSE_KEY,
		NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
	},

	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
	 * This is especially useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,

	/**
	 * Makes it so that empty strings are treated as undefined.
	 * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
