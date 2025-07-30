/**
 * Handler for processing tool execution results
 * Continues the agent loop after tool execution
 * 
 * NOTE: This handler needs to be refactored to work with the new Runtime-based
 * architecture instead of using EventEmitter. It's currently commented out.
 */

// TODO: Refactor this handler to work without EventEmitter
// The Runtime now handles tool execution and agent loop continuation

/*
import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { EventEmitter, SessionEventEmitter } from "../events/emitter";
import type { Message, ToolExecutionCompleteEvent, ToolExecutionFailedEvent } from "../events/schemas";
import { MessageReader } from "../server/readers/message-reader";
import { MessageWriter } from "../server/writers/message-writer";

export class ToolResultHandler {
	constructor(
		private redis: Redis,
		private eventEmitter: EventEmitter,
	) {}

	async handleToolComplete(event: ToolExecutionCompleteEvent): Promise<void> {
		// Implementation removed - needs refactoring
	}

	async handleToolFailed(event: ToolExecutionFailedEvent): Promise<void> {
		// Implementation removed - needs refactoring
	}
}
*/