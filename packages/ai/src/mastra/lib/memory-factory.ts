import type { z } from "zod";

/**
 * Factory function to create storage instances based on environment
 * Automatically selects storage backend based on environment variables
 * 
 * NOTE: This function is intended for server-side use only.
 * It dynamically imports storage dependencies to avoid client-side bundling.
 */
export async function createEnvironmentStorage() {
	const { LibSQLStore } = await import("@mastra/libsql");
	const { UpstashStore } = await import("@mastra/upstash");
	const { env } = await import("../../env");
	// Auto-detect environment based on NODE_ENV and deployment context
	const nodeEnv = env.NODE_ENV || "development";
	const isVercel = env.VERCEL === "1" || env.VERCEL_ENV !== undefined;
	const isProduction = nodeEnv === "production";

	// Use Upstash for production/serverless deployments
	if (isProduction || isVercel) {
		return new UpstashStore({
			url: env.KV_REST_API_URL,
			token: env.KV_REST_API_TOKEN,
		});
	}

	// Use LibSQL for development and testing
	return new LibSQLStore({
		url: nodeEnv === "test" ? ":memory:" : "file:./mastra.db",
	});
}

/**
 * Factory function to create Memory instances based on environment
 * Automatically selects storage backend based on environment variables
 * 
 * NOTE: This function is intended for server-side use only.
 * It dynamically imports Memory to avoid client-side bundling.
 */
export async function createEnvironmentMemory<T extends z.ZodRawShape>(
	options: {
		prefix?: string;
		workingMemoryTemplate?: string;
		workingMemorySchema?: z.ZodObject<T>;
		workingMemoryDefault?: z.infer<z.ZodObject<T>>;
		lastMessages?: number;
	} = {},
) {
	const { Memory } = await import("@mastra/memory");
	const { workingMemoryTemplate, workingMemorySchema, workingMemoryDefault, lastMessages = 50 } = options;

	// Prepare working memory config based on whether template or schema is provided
	let workingMemoryConfig:
		| { enabled: true; scope: "thread"; schema: z.ZodObject<T>; default?: z.infer<z.ZodObject<T>> }
		| { enabled: true; scope: "thread"; template: string }
		| undefined;
	if (workingMemorySchema) {
		workingMemoryConfig = {
			enabled: true,
			scope: "thread" as const,
			schema: workingMemorySchema,
			default: workingMemoryDefault,
		};
	} else if (workingMemoryTemplate) {
		workingMemoryConfig = {
			enabled: true,
			scope: "thread" as const,
			template: workingMemoryTemplate,
		};
	}

	return new Memory({
		storage: await createEnvironmentStorage(),
		options: {
			lastMessages,
			workingMemory: workingMemoryConfig,
		},
	});
}
