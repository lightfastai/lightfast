import { z } from "zod";

const envSchema = z.object({
	DATABASE_URL: z.string().optional(),
	ANTHROPIC_API_KEY: z.string().optional(),
	EXA_API_KEY: z.string().optional(),
	OPENAI_API_KEY: z.string().optional(),
	BROWSERBASE_API_KEY: z.string().optional(),
	BROWSERBASE_PROJECT_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
