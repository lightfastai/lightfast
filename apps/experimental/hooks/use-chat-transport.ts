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
		// Use the v API endpoint
		const apiEndpoint = `/api/v`;
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
						// Send agentId and threadId in the body
						agentId,
						threadId,
						// Send only the latest user message
						// Server will validate and return 400 if no messages
						messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
						// Include any additional metadata from the body
						...body,
					},
				};
			},
			prepareReconnectToStreamRequest: ({ api, headers }) => {
				// For GET requests (resume), append agentId and threadId as query params
				// GET requests cannot have a body according to HTTP standards
				return {
					api: `${api}?agentId=${agentId}&threadId=${threadId}`,
					headers,
				};
			},
		});
	}, [threadId, agentId]);

	return transport;
}
