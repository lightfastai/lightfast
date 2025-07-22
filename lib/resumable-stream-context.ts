import { nanoid } from "@/lib/nanoid";
import { after } from "next/server";
import { createResumableStreamContext, type ResumableStreamContext } from "resumable-stream";

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

export function generateStreamId(agentId: string, threadId: string): string {
	// Generate a unique stream ID with nanoid for better uniqueness
	// Format: agentId-threadId-nanoId
	return `${agentId}-${threadId}-${nanoid()}`;
}
