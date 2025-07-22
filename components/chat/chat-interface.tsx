"use client";

import { useChat } from "@ai-sdk/react";
import { ChatInput } from "@/components/chat-input";
import { useChatTransport } from "@/hooks/use-chat-transport";
import type { ExperimentalAgentId } from "@/mastra/agents/experimental/types";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { AgentVersionIndicator } from "./agent-version-indicator";
import { ChatBottomSection } from "./chat-bottom-section";
import { ChatMessages } from "./chat-messages";
import { EmptyState } from "./empty-state";

interface ChatInterfaceProps {
	agentId: ExperimentalAgentId;
	threadId: string;
	initialMessages?: LightfastUIMessage[];
}

export function ChatInterface({ agentId, threadId, initialMessages = [] }: ChatInterfaceProps) {
	// Create transport for AI SDK v5 with agentId
	const transport = useChatTransport({ threadId, agentId });

	// Use the chat hook with transport and LightfastUIMessage type
	const {
		messages,
		sendMessage: vercelSendMessage,
		status,
	} = useChat<LightfastUIMessage>({
		id: threadId,
		transport,
		messages: initialMessages,
	});

	const isLoading = status === "streaming" || status === "submitted";

	const handleSendMessage = async (message: string) => {
		if (!message.trim() || isLoading) return;

		try {
			// Generate IDs for the messages
			const userMessageId = `user-${Date.now()}`;
			const assistantMessageId = `assistant-${Date.now()}`;

			// Use vercelSendMessage with the correct AI SDK v5 format
			await vercelSendMessage(
				{
					role: "user",
					parts: [{ type: "text", text: message }],
					id: userMessageId,
				},
				{
					body: {
						id: assistantMessageId,
						userMessageId,
						threadClientId: threadId,
					},
				},
			);
		} catch (error) {
			throw error; // Re-throw to let ChatInput handle error state
		}
	};

	if (messages.length === 0) {
		return (
			<div className="flex-1 flex items-center p-6 overflow-hidden">
				<div className="w-full max-w-3xl mx-auto relative -top-12">
					<EmptyState />
					<ChatInput onSendMessage={handleSendMessage} placeholder="Type your message..." disabled={isLoading} />
				</div>
				{/* Only show on desktop */}
				<div className="hidden lg:block">
					<AgentVersionIndicator agentId={agentId} />
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col relative">
			<ChatMessages messages={messages} isLoading={isLoading} />
			<ChatBottomSection>
				<ChatInput onSendMessage={handleSendMessage} placeholder="Type your message..." disabled={isLoading} />
			</ChatBottomSection>
			{/* Only show on desktop */}
			<div className="hidden lg:block">
				<AgentVersionIndicator agentId={agentId} />
			</div>
		</div>
	);
}
