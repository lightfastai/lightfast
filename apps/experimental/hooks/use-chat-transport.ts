"use client";

import type { ExperimentalAgentId, LightfastUIMessage } from "@lightfast/types";
import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

interface UseChatTransportProps {
	threadId: string;
	agentId: ExperimentalAgentId;
	userId: string;
}

/**
 * Hook that creates and configures a DefaultChatTransport for Mastra integration
 */
export function useChatTransport({
	threadId,
	agentId,
	userId,
}: UseChatTransportProps): ChatTransport<LightfastUIMessage> {
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
						messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
						userId: userId,
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
	}, [threadId, agentId, userId]);

	return transport;
}
