import type { LightfastUIMessage, MastraUIMessage } from "@lightfast/types";

/**
 * Optimized message converter with minimal transformations
 *
 * Performance optimizations:
 * - Direct object mapping without intermediate arrays
 * - Reduced runtime type checks
 * - Optimized message merging logic
 */
export function convertMastraToUIMessages(mastraMessages: MastraUIMessage[]): LightfastUIMessage[] {
	if (!Array.isArray(mastraMessages) || mastraMessages.length === 0) {
		return [];
	}

	const result: LightfastUIMessage[] = [];
	let lastAssistantMessage: LightfastUIMessage | null = null;

	for (let i = 0; i < mastraMessages.length; i++) {
		const msg = mastraMessages[i];

		// Fast validation - check only essential properties
		if (!msg?.id || !msg.role || !msg.parts) {
			continue;
		}

		// Optimized assistant message merging
		if (msg.role === "assistant" && lastAssistantMessage) {
			// Merge parts directly without array spread for better performance
			const newParts = msg.parts as LightfastUIMessage["parts"];
			lastAssistantMessage.parts.push(...newParts);
			continue;
		}

		// Direct object creation - structures are compatible, minimal transformation
		const convertedMessage: LightfastUIMessage = {
			id: msg.id,
			role: msg.role,
			parts: msg.parts as LightfastUIMessage["parts"],
			metadata: msg.metadata,
		};

		result.push(convertedMessage);

		// Cache last assistant message for potential merging
		if (msg.role === "assistant") {
			lastAssistantMessage = convertedMessage;
		} else {
			lastAssistantMessage = null;
		}
	}

	return result;
}

/**
 * Fast message validation without conversion
 * Use this when you only need to check message validity
 */
export function isValidMastraMessage(msg: unknown): msg is MastraUIMessage {
	return Boolean(msg && typeof msg === "object" && "id" in msg && "role" in msg && "parts" in msg);
}
