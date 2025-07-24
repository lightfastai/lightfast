"use client";

import type { ExperimentalAgentId, LightfastUIMessage } from "@lightfast/types";
import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

interface UseChatTransportProps {
	threadId: string;
	agentId: ExperimentalAgentId;
}

/**
 * Hook that creates and configures a DefaultChatTransport for Mastra integration
 */
export function useChatTransport({ threadId, agentId }: UseChatTransportProps): ChatTransport<LightfastUIMessage> {
	const transport = useMemo(() => {
		const apiEndpoint = `/api/chat/${agentId}/${threadId}`;
		return new DefaultChatTransport<LightfastUIMessage>({
			api: apiEndpoint,
			headers: {
				"Content-Type": "application/json",
			},
			prepareSendMessagesRequest: ({ body, headers, messages, api }) => {
				// Transform the messages to the format expected by our API
				// The body contains metadata passed from sendMessage

				return {
					api,
					headers,
					body: {
						// Only send the latest message to prevent duplicates
						messages: [messages[messages.length - 1]],
						stream: true,
						threadId: threadId,
						// Include any additional metadata from the body
						...body,
					},
				};
			},
		});
	}, [threadId, agentId]);

	return transport;
}
