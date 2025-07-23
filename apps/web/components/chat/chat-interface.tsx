"use client";

import { useChat } from "@ai-sdk/react";
import { ChatInput } from "@/components/chat-input";
import { useDataStream } from "@/components/data-stream-provider";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatTransport } from "@/hooks/use-chat-transport";
import type { ExperimentalAgentId } from "@lightfast/types";
import type { LightfastUIMessage } from "@lightfast/types";
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
	const { setDataStream } = useDataStream();

	// Use the chat hook with transport and LightfastUIMessage type
	const {
		messages,
		sendMessage: vercelSendMessage,
		status,
		resumeStream,
		setMessages,
	} = useChat<LightfastUIMessage>({
		id: threadId,
		transport,
		messages: initialMessages,
		// Handle data stream parts - matches Vercel's implementation exactly
		onData: (dataPart) => {
			setDataStream((ds) => (ds ? [...ds, dataPart] : []));
		},
	});

	// Enable auto-resume when there are initial messages
	// This will resume streaming if the last message was from the user
	useAutoResume({
		autoResume: initialMessages.length > 0,
		initialMessages,
		resumeStream,
		setMessages,
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
					},
				},
			);
		} catch (error) {
			console.error("Failed to send message:", error);
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
