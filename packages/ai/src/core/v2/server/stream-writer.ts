/**
 * Stream Writer - Simple utility for writing messages to Redis streams
 * Used by workers to write agent responses, tool results, and status updates
 */

import type { Redis } from "@upstash/redis";
import type { StreamMessage } from "./types";

export class StreamWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write a message to a stream
	 */
	async writeMessage(streamKey: string, message: Partial<StreamMessage>): Promise<string> {
		// Flatten message object for Redis XADD
		const fields: Record<string, string> = {};
		Object.entries(message).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				fields[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
			}
		});

		// Write to Redis stream
		const id = await this.redis.xadd(streamKey, "*", fields);
		return id as string;
	}

	/**
	 * Write a text chunk (for streaming responses)
	 */
	async writeChunk(sessionId: string, content: string): Promise<string> {
		const streamKey = `v2:stream:${sessionId}`;
		return this.writeMessage(streamKey, {
			type: "chunk",
			content,
		});
	}

	/**
	 * Write a complete message (for final responses)
	 */
	async writeComplete(sessionId: string, content: string): Promise<string> {
		const streamKey = `v2:stream:${sessionId}`;
		return this.writeMessage(streamKey, {
			type: "complete",
			content,
		});
	}

	/**
	 * Write a status update
	 */
	async writeStatus(sessionId: string, status: string, metadata?: Record<string, any>): Promise<string> {
		const streamKey = `v2:stream:${sessionId}`;
		return this.writeMessage(streamKey, {
			type: "status",
			content: status,
			metadata,
		});
	}

	/**
	 * Write a tool execution event
	 */
	async writeToolExecution(
		sessionId: string,
		tool: string,
		status: "start" | "complete" | "error",
		result?: any,
	): Promise<string> {
		const streamKey = `v2:stream:${sessionId}`;
		return this.writeMessage(streamKey, {
			type: "tool",
			content: `Tool ${tool}: ${status}`,
			metadata: {
				tool,
				status,
				result,
			},
		});
	}

	/**
	 * Write an error message
	 */
	async writeError(sessionId: string, error: string, code?: string): Promise<string> {
		const streamKey = `v2:stream:${sessionId}`;
		return this.writeMessage(streamKey, {
			type: "error",
			content: error,
			metadata: { code },
		});
	}

	/**
	 * Write agent thinking/reasoning
	 */
	async writeThinking(sessionId: string, reasoning: string): Promise<string> {
		const streamKey = `v2:stream:${sessionId}`;
		return this.writeMessage(streamKey, {
			type: "thinking",
			content: reasoning,
		});
	}
}

/**
 * Create a stream writer instance
 */
export function createStreamWriter(redis: Redis): StreamWriter {
	return new StreamWriter(redis);
}
