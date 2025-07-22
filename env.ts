import { vercel } from "@t3-oss/env-core/presets-zod";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Extend from T3-OSS Vercel preset
	 */
	extends: [vercel()],

	/**
	 * Specify your server-side environment variables schema here.
	 * This way you can ensure the app isn't built with invalid env vars.
	 */
	server: {
		// Database
		DATABASE_URL: z.string().url().optional(),

		// Node environment
		NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

		// Upstash Redis
		UPSTASH_REDIS_URL: z.string().url(),
		UPSTASH_KV_URL: z.string().url(),
		UPSTASH_KV_REST_API_URL: z.string().url(),
		UPSTASH_KV_REST_API_TOKEN: z.string().min(1),
		UPSTASH_KV_REST_API_READ_ONLY_TOKEN: z.string().min(1),

		// Vercel Blob Storage
		BLOB_READ_WRITE_TOKEN: z.string().min(1),

		// API Keys
		ANTHROPIC_API_KEY: z.string().min(1),
		EXA_API_KEY: z.string().min(1),
		OPENAI_API_KEY: z.string().min(1),
		BROWSERBASE_API_KEY: z.string().min(1),
		BROWSERBASE_PROJECT_ID: z.string().min(1),
		ELEVENLABS_API_KEY: z.string().min(1).optional(),
		AI_GATEWAY_API_KEY: z.string().min(1).optional(),
		VIRTUOSO_LICENSE_KEY: z.string().min(1).optional(),
		BRAINTRUST_API_KEY: z.string().min(1),
		BRAINTRUST_PROJECT_ID: z.string().min(1),

		// Clerk Authentication
		CLERK_SECRET_KEY: z.string().min(1),
	},

	/**
	 * Specify your client-side environment variables schema here.
	 * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
	 */
	client: {
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		// Database
		DATABASE_URL: process.env.DATABASE_URL,

		// Node
		NODE_ENV: process.env.NODE_ENV,

		// Upstash Redis
		UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
		UPSTASH_KV_URL: process.env.UPSTASH_KV_URL,
		UPSTASH_KV_REST_API_URL: process.env.UPSTASH_KV_REST_API_URL,
		UPSTASH_KV_REST_API_TOKEN: process.env.UPSTASH_KV_REST_API_TOKEN,
		UPSTASH_KV_REST_API_READ_ONLY_TOKEN: process.env.UPSTASH_KV_REST_API_READ_ONLY_TOKEN,

		// Vercel Blob
		BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,

		// API Keys
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		EXA_API_KEY: process.env.EXA_API_KEY,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
		BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
		ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
		AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
		VIRTUOSO_LICENSE_KEY: process.env.VIRTUOSO_LICENSE_KEY,
		BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
		BRAINTRUST_PROJECT_ID: process.env.BRAINTRUST_PROJECT_ID,
		CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,

		// Client
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
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
