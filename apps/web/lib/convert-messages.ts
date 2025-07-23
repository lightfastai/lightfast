import type { LightfastUIMessage, MastraUIMessage } from "@lightfast/types";

/**
 * Convert Mastra memory UI messages to the format expected by Vercel AI SDK's useChat
 * 
 * Mastra's memory system stores messages in a format that's very close to the Vercel AI SDK format.
 * This function handles any necessary conversions and ensures type safety.
 */
export function convertMastraToUIMessages(mastraMessages: MastraUIMessage[]): LightfastUIMessage[] {
	const result: LightfastUIMessage[] = [];

	for (const msg of mastraMessages) {
		// Skip invalid/incomplete messages
		if (!msg?.id || !msg.role || !Array.isArray(msg.parts)) {
			continue;
		}

		// Check if we should merge with the previous assistant message
		if (msg.role === "assistant" && result.length > 0) {
			const lastMessage = result[result.length - 1];
			
			// If the last message exists and is also from assistant, merge parts
			if (lastMessage?.role === "assistant") {
				// Safely merge parts by spreading and type assertion
				const newParts = msg.parts as LightfastUIMessage["parts"];
				lastMessage.parts.push(...newParts);
				continue;
			}
		}

		// Create a new message with proper type conversion
		const convertedMessage: LightfastUIMessage = {
			id: msg.id,
			role: msg.role,
			parts: msg.parts as LightfastUIMessage["parts"], // Safe cast - structures are compatible
			metadata: msg.metadata,
		};

		result.push(convertedMessage);
	}

	return result;
}