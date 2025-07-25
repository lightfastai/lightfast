"use client";

import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface UseChatTransportProps {
	threadId: string;
	agentId: string;
}

/**
 * Hook that creates and configures a DefaultChatTransport for AI integration
 */
export function useChatTransport({ threadId, agentId }: UseChatTransportProps): ChatTransport<LightfastUIMessage> {
	const transport = useMemo(() => {
		// Use the v API endpoint with agentId and threadId in the path
		const apiEndpoint = `/api/v/${agentId}/${threadId}`;
		return new DefaultChatTransport<LightfastUIMessage>({
			api: apiEndpoint,
			headers: {
				"Content-Type": "application/json",
			},
			prepareSendMessagesRequest: ({ body, headers, messages, api }) => {
				return {
					api,
					headers,
					body: {
						// Send only the latest user message
						// Server will validate and return 400 if no messages
						messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
						// Include any additional metadata from the body
						...body,
					},
				};
			},
			prepareReconnectToStreamRequest: ({ api, headers }) => {
				// For GET requests (resume), use the same path
				return {
					api,
					headers,
				};
			},
		});
	}, [threadId, agentId]);

	return transport;
}
