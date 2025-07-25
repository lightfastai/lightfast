"use client";

import type { LightfastUIMessage } from "@lightfast/types";
import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

interface UseChatTransportProps {
	threadId: string;
	agentId: string;
}

/**
 * Hook that creates and configures a DefaultChatTransport for AI integration
 */
export function useChatTransport({ threadId, agentId }: UseChatTransportProps): ChatTransport<LightfastUIMessage> {
	const transport = useMemo(() => {
		// Use the (ai) route group structure with agentId and threadId
		const apiEndpoint = `/api/chat/${agentId}/${threadId}`;
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
				// No need for query parameters, the route handles agentId and threadId
				return {
					api,
					headers,
				};
			},
		});
	}, [threadId, agentId]);

	return transport;
}
