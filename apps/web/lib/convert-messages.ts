import type { LightfastUIMessage, MastraUIMessage } from "@/types/lightfast-ui-messages";

/**
 * Convert Mastra memory UI messages to the format expected by Vercel AI SDK's useChat
 */
export function convertMastraToUIMessages(mastraMessages: MastraUIMessage[]): LightfastUIMessage[] {
	const mergedMessages: LightfastUIMessage[] = [];

	for (let i = 0; i < mastraMessages.length; i++) {
		const msg = mastraMessages[i];

		if (msg.role === "assistant" && mergedMessages.length > 0) {
			const lastMessage = mergedMessages[mergedMessages.length - 1];

			// If the last message is also from assistant, merge parts
			if (lastMessage.role === "assistant") {
				// Cast each part individually as we push them
				const partsToAdd = (msg.parts || []) as LightfastUIMessage["parts"];
				lastMessage.parts.push(...partsToAdd);
				continue;
			}
		}

		// Add as new message
		// Note: We cast parts as LightfastUIMessage["parts"] since the structure is compatible
		// but TypeScript can't infer this automatically
		mergedMessages.push({
			id: msg.id,
			role: msg.role,
			parts: [...(msg.parts || [])] as LightfastUIMessage["parts"],
			metadata: msg.metadata,
		});
	}

	return mergedMessages;
}
