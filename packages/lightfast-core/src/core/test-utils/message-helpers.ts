/**
 * Test utilities for creating UIMessage objects
 */
import type { UIMessage } from "ai";

/**
 * Creates a UIMessage with text content
 */
export function createTextMessage(
	id: string,
	role: "system" | "user" | "assistant",
	content: string,
): UIMessage {
	return {
		id,
		role,
		parts: [
			{
				type: "text",
				text: content,
			},
		],
	};
}

/**
 * Creates a user message with text content
 */
export function createUserMessage(id: string, content: string): UIMessage {
	return createTextMessage(id, "user", content);
}

/**
 * Creates an assistant message with text content
 */
export function createAssistantMessage(id: string, content: string): UIMessage {
	return createTextMessage(id, "assistant", content);
}

/**
 * Creates a system message with text content
 */
export function createSystemMessage(id: string, content: string): UIMessage {
	return createTextMessage(id, "system", content);
}

/**
 * Type guard to check if an object has a content property
 */
interface MessageWithContent {
	content: string;
	role: string;
}

/**
 * Extracts text content from a UIMessage or ModelMessage
 */
export function getMessageText(message: UIMessage | MessageWithContent): string | undefined {
	// Handle ModelMessage format (has content property directly)
	if ("content" in message && typeof message.content === "string") {
		return message.content;
	}
	
	// Handle UIMessage format (has parts array)
	if ("parts" in message && Array.isArray(message.parts)) {
		const textPart = message.parts.find((part): part is { type: "text"; text: string } => 
			typeof part === "object" && 
			part !== null &&
			"type" in part && 
			part.type === "text" &&
			"text" in part &&
			typeof part.text === "string"
		);
		return textPart?.text;
	}
	
	return undefined;
}

/**
 * Creates a mock UIMessage for testing (backward compatible)
 * This is for tests that were using the simplified structure
 */
export function createMockMessage(
	id: string,
	role: "system" | "user" | "assistant",
	content: string,
): UIMessage {
	return createTextMessage(id, role, content);
}