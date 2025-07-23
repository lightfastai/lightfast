import { after } from "next/server";
import { createResumableStreamContext, type ResumableStreamContext } from "resumable-stream";
import type { ExperimentalAgentId } from "@lightfast/types";

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
	if (!globalStreamContext) {
		try {
			// Create resumable stream context
			// The resumable-stream package will use REDIS_URL from env automatically
			globalStreamContext = createResumableStreamContext({
				waitUntil: after,
			});
		} catch (error: any) {
			if (error.message.includes("REDIS_URL")) {
			} else {
				console.error("Failed to create resumable stream context:", error);
			}
			return null;
		}
	}

	return globalStreamContext;
}

export function generateStreamId(agentId: ExperimentalAgentId, threadId: string): string {
	// Generate a unique stream ID with UUID for better uniqueness
	// Format: agentId-threadId-uuid
	return `${agentId}-${threadId}-${crypto.randomUUID()}`;
}
