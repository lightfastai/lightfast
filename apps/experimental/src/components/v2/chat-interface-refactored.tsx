"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChatMessages } from "@/components/chat/chat-messages";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { useChatV2 } from "@/hooks/use-chat-v2";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface ChatInterfaceProps {
	agentId: string;
	sessionId: string;
	initialMessages?: UIMessage[];
}

/**
 * V2 ChatInterface using base components and useChatV2 hook
 */
export function ChatInterface({ agentId, sessionId, initialMessages = [] }: ChatInterfaceProps) {
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
		sessionId,
		initialMessages,
	});

	// Convert messages for display
	const displayMessages = convertToLightfastMessages(messages);

	const handleSendMessage = async (message: string) => {
		// Update URL immediately when sending first message
		if (window.location.pathname === `/v2-chat/${agentId}`) {
			window.history.replaceState(null, "", `/v2-chat/${agentId}/${sessionId}`);
		}

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
			<div className="relative">
				{/* Chat Input container with gradient */}
				<div className="relative bg-background pb-4">
					<ChatInput 
						onSendMessage={handleSendMessage} 
						placeholder="Ask Lightfast" 
						disabled={isLoading}
						withGradient={true}
						withDescription="This is an experiment by Lightfast. Use with discretion."
					/>
				</div>
			</div>
		</>
	);
}
