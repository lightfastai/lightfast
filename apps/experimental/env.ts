import { env as aiEnv } from "@lightfast/ai-experimental/v2/env";
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
		// Node environment
		NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

		// Additional KV tokens specific to www app
		KV_REST_API_READ_ONLY_TOKEN: z.string().min(1),

		// Additional AI Provider API Keys for www app
		OPENAI_API_KEY: z.string().min(1),
		EXA_API_KEY: z.string().min(1),

		// Browser automation
		BROWSERBASE_API_KEY: z.string().min(1),
		BROWSERBASE_PROJECT_ID: z.string().min(1),

		// Voice services
		ELEVENLABS_API_KEY: z.string().min(1).optional(),

		// Observability
		BRAINTRUST_API_KEY: z.string().min(1),
		BRAINTRUST_PROJECT_NAME: z.string().min(1),
		OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("https://api.braintrust.dev/otel"),
		OTEL_EXPORTER_OTLP_HEADERS: z.string().min(1).optional(),

		// Vercel Blob Storage
		BLOB_READ_WRITE_TOKEN: z.string().min(1),

		// Additional Redis URLs
		REDIS_URL: z.string().url(),
		KV_URL: z.string().url(),

		// Clerk Authentication
		CLERK_SECRET_KEY: z.string().min(1),

		// Additional AI keys
		ANTHROPIC_API_KEY: z.string().min(1),
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
	experimental__runtimeEnv: {
		// Client env vars only
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
