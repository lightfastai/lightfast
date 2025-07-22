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

	const handleSendMessage = async (message: string) => {
		if (!message.trim() || status === "streaming" || status === "submitted") return;

		try {
			// Generate UUID for the user message
			const userMessageId = crypto.randomUUID();

			// Use vercelSendMessage with the correct AI SDK v5 format
			await vercelSendMessage(
				{
					role: "user",
					parts: [{ type: "text", text: message }],
					id: userMessageId,
				},
				{
					body: {
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
			<div className="flex-1 flex items-center overflow-hidden">
				<div className="w-full relative -top-12">
					<div className="chat-container">
						<EmptyState />
					</div>
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Type your message..."
						disabled={status === "streaming" || status === "submitted"}
					/>
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
			<ChatMessages messages={messages} status={status} />
			<ChatBottomSection>
				<ChatInput
					onSendMessage={handleSendMessage}
					placeholder="Type your message..."
					disabled={status === "streaming" || status === "submitted"}
				/>
			</ChatBottomSection>
			{/* Only show on desktop */}
			<div className="hidden lg:block">
				<AgentVersionIndicator agentId={agentId} />
			</div>
		</div>
	);
}
