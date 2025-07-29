/**
 * Handler for processing tool execution results
 * Continues the agent loop after tool execution
 */

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

	/**
	 * Handle tool execution complete event
	 */
	async handleToolComplete(event: ToolExecutionCompleteEvent): Promise<void> {
		const sessionEmitter = this.eventEmitter.forSession(event.sessionId);
		const messageReader = new MessageReader(this.redis);
		const messageWriter = new MessageWriter(this.redis);

		try {
			// Get existing messages
			const uiMessages = await messageReader.getMessages(event.sessionId);

			// Convert UIMessages to Messages format
			const messages: Message[] = uiMessages.map((msg) => {
				const metadata = msg.metadata as any;
				return {
					role: msg.role,
					content: msg.parts.find((p) => p.type === "text")?.text || "",
					...(metadata?.toolCallId && { toolCallId: metadata.toolCallId }),
				};
			});

			// Add tool result to messages
			const toolResultMessage: Message = {
				role: "tool",
				content: JSON.stringify(event.data.result),
				toolCallId: event.data.toolCallId,
			};
			messages.push(toolResultMessage);

			// Write tool result as UIMessage
			const toolResultUIMessage: UIMessage = {
				id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
				role: "assistant",
				parts: [
					{
						type: "text",
						text: `Tool result: ${JSON.stringify(event.data.result)}`,
					},
				],
				metadata: {
					toolCallId: event.data.toolCallId,
					toolName: event.data.tool,
				},
			};
			await messageWriter.writeUIMessage(event.sessionId, toolResultUIMessage);

			// Emit agent loop init event to continue processing
			await sessionEmitter.emitAgentLoopInit({
				messages,
				temperature: 0.7, // Default temperature
				metadata: {
					continuedFromTool: event.data.tool,
				},
			});
		} catch (error) {
			console.error(`[ToolResultHandler] Error handling tool complete:`, error);
			throw error;
		}
	}

	/**
	 * Handle tool execution failed event
	 */
	async handleToolFailed(event: ToolExecutionFailedEvent): Promise<void> {
		const sessionEmitter = this.eventEmitter.forSession(event.sessionId);
		const messageReader = new MessageReader(this.redis);
		const messageWriter = new MessageWriter(this.redis);

		try {
			// Get existing messages
			const uiMessages = await messageReader.getMessages(event.sessionId);

			// Convert UIMessages to Messages format
			const messages: Message[] = uiMessages.map((msg) => {
				const metadata = msg.metadata as any;
				return {
					role: msg.role,
					content: msg.parts.find((p) => p.type === "text")?.text || "",
					...(metadata?.toolCallId && { toolCallId: metadata.toolCallId }),
				};
			});

			// Add error message
			const errorMessage: Message = {
				role: "tool",
				content: `Error: ${event.data.error}`,
				toolCallId: event.data.toolCallId,
			};
			messages.push(errorMessage);

			// Write error as UIMessage
			const errorUIMessage: UIMessage = {
				id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
				role: "assistant",
				parts: [
					{
						type: "text",
						text: `Tool error: ${event.data.error}`,
					},
				],
				metadata: {
					toolCallId: event.data.toolCallId,
					toolName: event.data.tool,
					isError: true,
				},
			};
			await messageWriter.writeUIMessage(event.sessionId, errorUIMessage);

			// Emit agent loop init event to continue processing with error context
			await sessionEmitter.emitAgentLoopInit({
				messages,
				temperature: 0.7, // Default temperature
				metadata: {
					toolError: {
						tool: event.data.tool,
						error: event.data.error,
					},
				},
			});
		} catch (error) {
			console.error(`[ToolResultHandler] Error handling tool failure:`, error);
			throw error;
		}
	}
}
