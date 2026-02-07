import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Embedding provider environment variables
 *
 * Validates API keys for embedding providers (Cohere, OpenAI, etc.)
 */
export const embedEnv = createEnv({
	server: {
		COHERE_API_KEY: z.string().min(1),
		OPENAI_API_KEY: z.string().min(1).optional(),
	},
	runtimeEnv: {
		COHERE_API_KEY: process.env.COHERE_API_KEY,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	},
	skipValidation:
		!!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
});
