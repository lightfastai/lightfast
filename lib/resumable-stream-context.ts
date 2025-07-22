import { nanoid } from "nanoid";
import { after } from "next/server";
import { createClient } from "redis";
import { createResumableStreamContext, type ResumableStreamContext } from "resumable-stream";
import { env } from "@/env";

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
	if (!globalStreamContext) {
		try {
			// Get the Redis URL from our environment variables
			const redisUrl = env.UPSTASH_REDIS_URL;

			if (!redisUrl) {
				throw new Error("No Upstash Redis URL found in environment variables");
			}

			// Create Redis clients with our Upstash URL
			const publisher = createClient({ url: redisUrl });
			const subscriber = createClient({ url: redisUrl });

			// Create resumable stream context with our custom Redis clients
			globalStreamContext = createResumableStreamContext({
				waitUntil: after,
				publisher,
				subscriber,
			});
		} catch (error: any) {
			if (error.message.includes("Upstash Redis URL")) {
				console.log(" > Resumable streams are disabled due to missing Upstash Redis configuration");
			} else {
				console.error("Failed to create resumable stream context:", error);
			}
		}
	}

	return globalStreamContext;
}

export function generateStreamId(agentId: string, threadId: string): string {
	// Generate a unique stream ID with nanoid for better uniqueness
	// Format: agentId-threadId-nanoId
	return `${agentId}-${threadId}-${nanoid()}`;
}
