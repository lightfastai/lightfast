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
		// Node environment
		NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

		// Vercel environment detection
		VERCEL: z.string().optional(),
		VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),

		// KV Store for memory
		KV_REST_API_URL: z.string().url(),
		KV_REST_API_TOKEN: z.string().min(1),
		KV_REST_API_READ_ONLY_TOKEN: z.string().min(1),

		// AI Provider API Keys
		ANTHROPIC_API_KEY: z.string().min(1),
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

		// AI Gateway (required)
		AI_GATEWAY_API_KEY: z.string().min(1),

		// Redis & KV Store (additional)
		REDIS_URL: z.string().url(),
		KV_URL: z.string().url(),

		// Clerk Authentication
		CLERK_SECRET_KEY: z.string().min(1),

		// Qstash Event System
		QSTASH_URL: z.string().url().default("https://qstash.upstash.io"),
		QSTASH_TOKEN: z.string().min(1),
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
		// Node environment
		NODE_ENV: process.env.NODE_ENV,
		VERCEL: process.env.VERCEL,
		VERCEL_ENV: process.env.VERCEL_ENV,

		// KV Store for memory
		KV_REST_API_URL: process.env.KV_REST_API_URL,
		KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
		KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN,

		// AI Provider API Keys
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		EXA_API_KEY: process.env.EXA_API_KEY,

		// Browser automation
		BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
		BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,

		// Voice services
		ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,

		// Observability
		BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
		BRAINTRUST_PROJECT_NAME: process.env.BRAINTRUST_PROJECT_NAME,
		OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
		OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,

		// Vercel Blob Storage
		BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,

		// AI Gateway
		AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,

		// Redis & KV Store (additional)
		REDIS_URL: process.env.REDIS_URL,
		KV_URL: process.env.KV_URL,

		// Clerk Authentication
		CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,

		// Qstash Event System
		QSTASH_URL: process.env.QSTASH_URL,
		QSTASH_TOKEN: process.env.QSTASH_TOKEN,

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
