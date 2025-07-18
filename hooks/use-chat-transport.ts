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
				const finalThreadId = body?.threadClientId || threadId;
				
				console.log(`[TRANSPORT] Preparing request for thread: ${finalThreadId}`);
				console.log(`[TRANSPORT] API endpoint: ${api}`);
				console.log(`[TRANSPORT] Body threadClientId: ${body?.threadClientId}`);
				console.log(`[TRANSPORT] Hook threadId: ${threadId}`);
				
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
	}, [threadId]);

	return transport;
}
