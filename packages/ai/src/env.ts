import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Server-side environment variables for AI package
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
		BRAINTRUST_PROJECT_ID: z.string().min(1),

		// Vercel Blob Storage
		BLOB_READ_WRITE_TOKEN: z.string().min(1),

		// AI Gateway (optional)
		AI_GATEWAY_API_KEY: z.string().min(1).optional(),
	},

	/**
	 * Runtime environment variables - must be destructured manually
	 */
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		VERCEL: process.env.VERCEL,
		VERCEL_ENV: process.env.VERCEL_ENV,
		KV_REST_API_URL: process.env.KV_REST_API_URL,
		KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		EXA_API_KEY: process.env.EXA_API_KEY,
		BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
		BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
		ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
		BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
		BRAINTRUST_PROJECT_ID: process.env.BRAINTRUST_PROJECT_ID,
		BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
		AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
	},

	/**
	 * Skip validation if SKIP_ENV_VALIDATION is set
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,

	/**
	 * Empty strings are treated as undefined
	 */
	emptyStringAsUndefined: true,
});
