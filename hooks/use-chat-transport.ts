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
				const finalThreadId = body?.threadClientId || threadId;

				return {
					api,
					headers,
					body: {
						messages: messages,
						stream: true,
						threadId: finalThreadId,
						// Include any additional metadata from the body
						...body,
					},
				};
			},
		});
	}, [threadId, agentId]);

	return transport;
}
