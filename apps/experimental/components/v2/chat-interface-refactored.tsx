"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChatBottomSection } from "@/components/chat/chat-bottom-section";
import { ChatMessages } from "@/components/chat/chat-messages";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatInput } from "@/components/chat-input";
import { useChatV2 } from "@/hooks/use-chat-v2";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface ChatInterfaceProps {
	agentId: string;
	threadId: string;
	initialMessages?: UIMessage[];
}

/**
 * V2 ChatInterface using base components and useChatV2 hook
 */
export function ChatInterface({ agentId, threadId, initialMessages = [] }: ChatInterfaceProps) {
	const router = useRouter();

	// Convert UIMessage to LightfastUIMessage for compatibility with ChatMessages
	const convertToLightfastMessages = (messages: UIMessage[]): LightfastUIMessage[] => {
		return messages.map(
			(msg) =>
				({
					...msg,
					parts: msg.parts || [],
				}) as LightfastUIMessage,
		);
	};

	const { messages, sendMessage, status, isLoading, currentResponse } = useChatV2({
		agentId,
		threadId,
		initialMessages,
	});

	// Update URL when first message is sent
	useEffect(() => {
		if (messages.length > 0 && window.location.pathname === `/v2-chat/${agentId}`) {
			router.replace(`/v2-chat/${agentId}/${threadId}`);
		}
	}, [messages.length, agentId, threadId, router]);

	// Convert messages for display
	const displayMessages = convertToLightfastMessages(messages);

	// Add current streaming response as a temporary message
	if (currentResponse) {
		displayMessages.push({
			id: "streaming-message",
			role: "assistant",
			parts: [{ type: "text", text: currentResponse }],
		});
	}

	const handleSendMessage = async (message: string) => {
		try {
			await sendMessage(message);
		} catch (error) {
			console.error("Failed to send message:", error);
		}
	};

	// Empty state
	if (displayMessages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="w-full max-w-3xl px-4">
					<div className="px-4">
						<EmptyState />
					</div>
					<ChatInput onSendMessage={handleSendMessage} placeholder="Ask Lightfast" disabled={isLoading} />
				</div>
			</div>
		);
	}

	// Chat with messages
	return (
		<>
			<ChatMessages messages={displayMessages} status={status} />
			<ChatBottomSection>
				<ChatInput onSendMessage={handleSendMessage} placeholder="Ask Lightfast" disabled={isLoading} />
			</ChatBottomSection>
		</>
	);
}
