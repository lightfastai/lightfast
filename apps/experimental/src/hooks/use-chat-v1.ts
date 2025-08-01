"use client";

import { useChat as useVercelChat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { useChatTransport } from "@/hooks/use-chat-transport";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface UseChatV1Options {
	agentId: string;
	threadId: string;
	initialMessages?: LightfastUIMessage[];
	onError?: (error: Error) => void;
}

interface UseChatV1Return {
	messages: LightfastUIMessage[];
	sendMessage: (message: string) => Promise<void>;
	status: ChatStatus;
	isLoading: boolean;
}

export function useChatV1({ agentId, threadId, initialMessages = [], onError }: UseChatV1Options): UseChatV1Return {
	// Create transport for AI SDK v5 with agentId
	const transport = useChatTransport({ threadId, agentId });

	// Auto-resume interrupted streams if the last message was from user
	const shouldAutoResume = initialMessages.length > 0 && initialMessages[initialMessages.length - 1]?.role === "user";

	// Use the chat hook with transport and LightfastUIMessage type
	const {
		messages,
		sendMessage: vercelSendMessage,
		status,
	} = useVercelChat<LightfastUIMessage>({
		id: `${agentId}-${threadId}`,
		transport,
		messages: initialMessages,
		onError:
			onError ||
			((error) => {
				console.error("Error streaming text:", error);
			}),
		resume: shouldAutoResume,
	});

	const sendMessage = async (message: string) => {
		if (!message.trim() || status === "streaming" || status === "submitted") {
			throw new Error("Cannot send message");
		}

		// Generate UUID for the user message
		const userMessageId = crypto.randomUUID();

		// Use vercelSendMessage with the correct AI SDK v5 format
		await vercelSendMessage(
			{
				role: "user",
				parts: [{ type: "text", text: message }],
				id: userMessageId,
			},
			{
				body: {
					userMessageId,
				},
			},
		);
	};

	return {
		messages,
		sendMessage,
		status,
		isLoading: status === "streaming" || status === "submitted",
	};
}
