"use client";

import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface UseChatTransportProps {
	threadId: string;
}

/**
 * Hook that creates and configures a DefaultChatTransport for Mastra integration
 */
export function useChatTransport({ threadId }: UseChatTransportProps): ChatTransport<LightfastUIMessage> {
	const transport = useMemo(() => {
		return new DefaultChatTransport<LightfastUIMessage>({
			api: `/api/chat/thread/${threadId}`,
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
						messages: messages,
						stream: true,
						threadId: body?.threadClientId || threadId,
						// Include any additional metadata from the body
						...body,
					},
				};
			},
		});
	}, [threadId]);

	return transport;
}
