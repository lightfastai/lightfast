/**
 * Message Writer - Utility for writing UIMessages to Redis JSON storage
 * Used by workers to write agent responses and tool results
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import { getDeltaStreamKey, getMessageKey } from "../keys";
import { DeltaStreamType } from "../stream/types";

interface LightfastDBMessage {
	sessionId: string;
	resourceId: string;
	messages: UIMessage[];
	createdAt: string;
	updatedAt: string;
}

export class MessageWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write multiple UIMessages at once
	 */
	async writeUIMessages(
		sessionId: string,
		resourceId: string,
		messages: UIMessage[],
	): Promise<void> {
		if (messages.length === 0) return;

		const key = getMessageKey(sessionId);
		const now = new Date().toISOString();

		// Get existing data or create new
		const existing = await this.redis.json.get(key, "$") as LightfastDBMessage[] | null;

		if (!existing || existing.length === 0) {
			// Create new storage
			const storage: LightfastDBMessage = {
				sessionId,
				resourceId,
				messages,
				createdAt: now,
				updatedAt: now,
			};
			await this.redis.json.set(
				key,
				"$",
				storage as unknown as Record<string, unknown>,
			);
		} else {
			// Use pipeline for atomic operation
			const pipeline = this.redis.pipeline();
			pipeline.json.arrappend(
				key,
				"$.messages",
				...(messages as unknown as Record<string, unknown>[]),
			);
			pipeline.json.set(key, "$.updatedAt", now);
			await pipeline.exec();
		}
	}

	/**
	 * Write a single UIMessage (convenience method)
	 */
	async writeUIMessage(
		sessionId: string,
		resourceId: string,
		message: UIMessage,
	): Promise<void> {
		await this.writeUIMessages(sessionId, resourceId, [message]);
	}

	/**
	 * Update an existing message by replacing its parts
	 * Used for updating assistant messages with complete content
	 */
	async updateMessageParts(
		sessionId: string,
		messageId: string,
		newParts: any[],
	): Promise<void> {
		const key = getMessageKey(sessionId);
		const now = new Date().toISOString();

		// Get existing data
		const existing = await this.redis.json.get(key, "$") as LightfastDBMessage[] | null;
		if (!existing || existing.length === 0) {
			throw new Error(`No messages found for session ${sessionId}`);
		}

		// Find the message to update
		const messages = existing[0]?.messages || [];
		const messageIndex = messages.findIndex(
			(m: UIMessage) => m.id === messageId,
		);

		if (messageIndex < 0) {
			throw new Error(`Message ${messageId} not found in session ${sessionId}`);
		}

		// Replace the parts entirely
		const existingMessage = messages[messageIndex];
		if (existingMessage) {
			const updatedMessage = {
				...existingMessage,
				parts: newParts,
			};

			// Update the specific message in the array
			const pipeline = this.redis.pipeline();
			pipeline.json.set(
				key,
				`$.messages[${messageIndex}]`,
				updatedMessage as unknown as Record<string, unknown>,
			);
			pipeline.json.set(key, "$.updatedAt", now);
			await pipeline.exec();
		}
	}

	/**
	 * Add new parts to an existing message
	 * Used for adding tool results to assistant messages
	 */
	async appendMessageParts(
		sessionId: string,
		messageId: string,
		newParts: any[],
	): Promise<void> {
		const key = getMessageKey(sessionId);
		const now = new Date().toISOString();

		// Get existing data
		const existing = await this.redis.json.get(key, "$") as LightfastDBMessage[] | null;
		if (!existing || existing.length === 0) {
			throw new Error(`No messages found for session ${sessionId}`);
		}

		// Find the message to update
		const messages = existing[0]?.messages || [];
		const messageIndex = messages.findIndex(
			(m: UIMessage) => m.id === messageId,
		);

		if (messageIndex < 0) {
			throw new Error(`Message ${messageId} not found in session ${sessionId}`);
		}

		// Append the new parts to existing parts
		const existingMessage = messages[messageIndex];
		if (existingMessage) {
			const updatedMessage = {
				...existingMessage,
				parts: [...(existingMessage.parts || []), ...newParts],
			};

			// Update the specific message in the array
			const pipeline = this.redis.pipeline();
			pipeline.json.set(
				key,
				`$.messages[${messageIndex}]`,
				updatedMessage as unknown as Record<string, unknown>,
			);
			pipeline.json.set(key, "$.updatedAt", now);
			await pipeline.exec();
		}
	}

	/**
	 * Update a tool call part with its result
	 * Finds the existing tool call part and updates it with the output
	 */
	async updateToolCallResult(
		sessionId: string,
		messageId: string,
		toolCallId: string,
		toolResult: any,
	): Promise<void> {
		const key = getMessageKey(sessionId);
		const now = new Date().toISOString();

		// Get existing data
		const existing = await this.redis.json.get(key, "$") as LightfastDBMessage[] | null;
		if (!existing || existing.length === 0) {
			throw new Error(`No messages found for session ${sessionId}`);
		}

		// Find the message to update
		const messages = existing[0]?.messages || [];
		const messageIndex = messages.findIndex(
			(m: UIMessage) => m.id === messageId,
		);

		if (messageIndex < 0) {
			throw new Error(`Message ${messageId} not found in session ${sessionId}`);
		}

		// Update the tool call part with the result
		const existingMessage = messages[messageIndex];
		if (existingMessage?.parts) {
			// Find the tool call part
			const updatedParts = existingMessage.parts.map((part: any) => {
				if (part.toolCallId === toolCallId) {
					// Update the existing tool call part with the result
					return {
						...part,
						state: "output-available",
						output: toolResult,
					};
				}
				return part;
			});

			const updatedMessage = {
				...existingMessage,
				parts: updatedParts,
			};

			// Update the specific message in the array
			const pipeline = this.redis.pipeline();
			pipeline.json.set(
				key,
				`$.messages[${messageIndex}]`,
				updatedMessage as unknown as Record<string, unknown>,
			);
			pipeline.json.set(key, "$.updatedAt", now);
			await pipeline.exec();
		}
	}

	/**
	 * Atomically write a UIMessage and complete the associated stream
	 * This prevents race conditions where stream completion happens before message is stored
	 */
	async writeUIMessageWithStreamComplete(
		sessionId: string,
		resourceId: string,
		message: UIMessage,
		streamId: string,
	): Promise<void> {
		const messageKey = getMessageKey(sessionId);
		const streamKey = getDeltaStreamKey(streamId);
		const now = new Date().toISOString();

		// Get existing data or create new
		const existing = await this.redis.json.get(messageKey, "$") as LightfastDBMessage[] | null;

		const pipeline = this.redis.pipeline();

		if (!existing || existing.length === 0) {
			// Create new storage
			const storage: LightfastDBMessage = {
				sessionId,
				resourceId,
				messages: [message],
				createdAt: now,
				updatedAt: now,
			};
			pipeline.json.set(
				messageKey,
				"$",
				storage as unknown as Record<string, unknown>,
			);
		} else {
			// Check if this message ID already exists
			const messages = existing[0]?.messages || [];
			const existingMessageIndex = messages.findIndex(
				(m: UIMessage) => m.id === message.id,
			);

			if (existingMessageIndex >= 0) {
				// Message exists - merge parts instead of creating duplicate
				const existingMessage = messages[existingMessageIndex];
				if (existingMessage) {
					const updatedMessage = {
						...existingMessage,
						parts: [...(existingMessage.parts || []), ...(message.parts || [])],
					};

					// Update the specific message in the array
					pipeline.json.set(
						messageKey,
						`$.messages[${existingMessageIndex}]`,
						updatedMessage as unknown as Record<string, unknown>,
					);
				}
			} else {
				// New message - append to array
				pipeline.json.arrappend(
					messageKey,
					"$.messages",
					message as unknown as Record<string, unknown>,
				);
			}
			pipeline.json.set(messageKey, "$.updatedAt", now);
		}

		// Complete the stream atomically
		pipeline.xadd(streamKey, "*", {
			type: DeltaStreamType.COMPLETE,
			timestamp: now,
		});

		// Publish for real-time notifications
		pipeline.publish(
			streamKey,
			JSON.stringify({ type: DeltaStreamType.COMPLETE }),
		);

		// Execute all operations atomically
		await pipeline.exec();
	}
}
