import { after } from "next/server";
import { createResumableStreamContext, type ResumableStreamContext } from "resumable-stream";

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
	if (!globalStreamContext) {
		try {
			// Create resumable stream context using Upstash Redis
			// The resumable-stream package will automatically use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
			globalStreamContext = createResumableStreamContext({
				waitUntil: after,
			});
		} catch (error: any) {
			if (error.message.includes("UPSTASH_REDIS_REST_URL") || error.message.includes("REDIS_URL")) {
				console.log(" > Resumable streams are disabled due to missing Upstash Redis configuration");
			} else {
				console.error("Failed to create resumable stream context:", error);
			}
		}
	}

	return globalStreamContext;
}

export function generateStreamId(agentId: string, threadId: string): string {
	// Generate a unique stream ID based on agent and thread
	return `${agentId}-${threadId}-${Date.now()}`;
}
