"use client";

import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";

interface UseChatTransportProps {
	sessionId: string;
	agentId: string;
}

/**
 * Hook that creates and configures a DefaultChatTransport for AI integration
 * Note: webSearchEnabled should be passed per-message in the body, not in transport config
 */
export function useChatTransport({
	sessionId,
	agentId,
}: UseChatTransportProps): ChatTransport<LightfastAppChatUIMessage> {
	const transport = useMemo(() => {
		// Use the v API endpoint with agentId and sessionId in the path
		const apiEndpoint = `/api/v/${agentId}/${sessionId}`;
		return new DefaultChatTransport<LightfastAppChatUIMessage>({
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
						// Include any additional metadata from the body (including webSearchEnabled)
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
	}, [sessionId, agentId]);

	return transport;
}

