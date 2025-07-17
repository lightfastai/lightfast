import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { UpstashStore } from "@mastra/upstash";
import { env } from "../../env";

/**
 * Factory function to create storage instances based on environment
 * Automatically selects storage backend based on environment variables
 */
export function createEnvironmentStorage() {
	// Auto-detect environment based on NODE_ENV and deployment context
	const nodeEnv = env.NODE_ENV || "development";
	const isVercel = env.VERCEL === "1" || env.VERCEL_ENV !== undefined;
	const isProduction = nodeEnv === "production";

	// Use Upstash for production/serverless deployments
	if (isProduction || isVercel) {
		return new UpstashStore({
			url: env.UPSTASH_REDIS_REST_URL || "http://localhost:8089",
			token: env.UPSTASH_REDIS_REST_TOKEN || "test_token",
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
 */
export function createEnvironmentMemory(options: {
	prefix?: string;
	workingMemoryTemplate?: string;
	lastMessages?: number;
} = {}): Memory {
	const { workingMemoryTemplate, lastMessages = 50 } = options;

	return new Memory({
		storage: createEnvironmentStorage(),
		options: {
			lastMessages,
			workingMemory: workingMemoryTemplate ? {
				enabled: true,
				scope: "thread" as const,
				template: workingMemoryTemplate,
			} : undefined,
		},
	});
}

/**
 * Legacy function for backward compatibility
 * Creates a Memory instance with fixed storage (non-dynamic)
 */
export function createStaticMemory(forceUpstash = false): Memory {
	if (forceUpstash || env.NODE_ENV === "production") {
		return new Memory({
			storage: new UpstashStore({
				url: env.UPSTASH_REDIS_REST_URL || "http://localhost:8089",
				token: env.UPSTASH_REDIS_REST_TOKEN || "test_token",
			}),
			options: {
				lastMessages: 50,
				workingMemory: {
					enabled: true,
					scope: "thread",
				},
			},
		});
	}
	
	return new Memory({
		storage: new LibSQLStore({
			url: "file:./mastra.db",
		}),
		options: {
			lastMessages: 50,
			workingMemory: {
				enabled: true,
				scope: "thread",
			},
		},
	});
}