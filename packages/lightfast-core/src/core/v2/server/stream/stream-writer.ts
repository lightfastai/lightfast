/**
 * Stream Writer - Handles writing error and complete events to delta streams
 */

import type { Redis } from "@upstash/redis";
import { getDeltaStreamKey } from "../keys";
import {
	DeltaStreamType
	
	
} from "./types";
import type {ToolCallPart, ToolResultPart} from "./types";

export class StreamWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write an initialization event to the delta stream
	 */
	async writeInit(streamId: string): Promise<void> {
		const streamKey = getDeltaStreamKey(streamId);

		const message: Record<string, string> = {
			type: DeltaStreamType.INIT,
			timestamp: new Date().toISOString(),
		};

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.INIT });
	}

	/**
	 * Write an error event to the delta stream
	 */
	async writeError(streamId: string, error: string): Promise<void> {
		const streamKey = getDeltaStreamKey(streamId);

		const message: Record<string, string> = {
			type: DeltaStreamType.ERROR,
			error,
			timestamp: new Date().toISOString(),
		};

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.ERROR });
	}

	/**
	 * Write a chunk event to the delta stream
	 */
	async writeChunk(streamId: string, content: string): Promise<void> {
		const streamKey = getDeltaStreamKey(streamId);

		const message: Record<string, string> = {
			type: DeltaStreamType.CHUNK,
			content,
			timestamp: new Date().toISOString(),
		};

		// Use pipeline for better performance
		const pipeline = this.redis.pipeline();

		// Write to Redis stream
		pipeline.xadd(streamKey, "*", message);

		// Set TTL on delta stream (1 hour) - extends TTL on each write
		pipeline.expire(streamKey, 3600);

		// Publish for real-time notifications
		pipeline.publish(streamKey, { type: DeltaStreamType.CHUNK });

		// Execute all operations atomically
		await pipeline.exec();
	}

	/**
	 * Write a tool call event to the delta stream
	 */
	async writeToolCall(streamId: string, toolCall: ToolCallPart): Promise<void> {
		const streamKey = getDeltaStreamKey(streamId);

		const message: Record<string, string> = {
			type: DeltaStreamType.TOOL_CALL,
			// Serialize the tool call as JSON
			toolCall: JSON.stringify(toolCall),
			timestamp: new Date().toISOString(),
		};

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.TOOL_CALL });
	}

	/**
	 * Write a tool result event to the delta stream
	 */
	async writeToolResult(
		streamId: string,
		toolResult: ToolResultPart,
	): Promise<void> {
		const streamKey = getDeltaStreamKey(streamId);

		const message: Record<string, string> = {
			type: DeltaStreamType.TOOL_RESULT,
			// Serialize the tool result as JSON
			toolResult: JSON.stringify(toolResult),
			timestamp: new Date().toISOString(),
		};

		console.log(
			`[StreamWriter] Writing TOOL_RESULT to Redis stream ${streamKey}:`,
			message,
		);

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.TOOL_RESULT });

		console.log(
			`[StreamWriter] TOOL_RESULT written and published to ${streamKey}`,
		);
	}

	/**
	 * Write a completion event to the delta stream
	 */
	async writeComplete(streamId: string): Promise<void> {
		const streamKey = getDeltaStreamKey(streamId);

		const message: Record<string, string> = {
			type: DeltaStreamType.COMPLETE,
			timestamp: new Date().toISOString(),
		};

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.COMPLETE });
	}
}
