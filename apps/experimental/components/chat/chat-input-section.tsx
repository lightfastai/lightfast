"use client";

import { useChat } from "@ai-sdk/react";
import type { ExperimentalAgentId, LightfastUIMessage } from "@lightfast/types";
import { ChatInput } from "@/components/chat-input";
import { useChatTransport } from "@/hooks/use-chat-transport";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useDataStream } from "@/components/data-stream-provider";
import { ChatBottomSection } from "./chat-bottom-section";
import { ChatMessages } from "./chat-messages";
import { EmptyState } from "./empty-state";
import { uuidv4 } from "@/lib/uuidv4";

interface ChatInputSectionProps {
	agentId: ExperimentalAgentId;
	threadId: string;
	userId: string;
	initialMessages?: LightfastUIMessage[];
}

/**
 * Client component that handles chat interactivity
 * Isolated from server-rendered content for better performance
 */
export function ChatInputSection({ agentId, threadId, userId, initialMessages = [] }: ChatInputSectionProps) {
	const { setDataStream } = useDataStream();

	// Create transport for AI SDK v5 with agentId
	const transport = useChatTransport({ threadId, agentId, userId });

	// Use the chat hook with transport and LightfastUIMessage type
	// The key is to use a stable ID that includes both agentId and threadId
	// This ensures the hook creates a fresh instance for each new chat
	const {
		messages,
		sendMessage: vercelSendMessage,
		status,
		setMessages,
		resumeStream,
	} = useChat<LightfastUIMessage>({
		id: `${agentId}-${threadId}`,
		transport,
		messages: initialMessages,
		onData: (dataPart) => {
			setDataStream((ds) => (ds ? [...ds, dataPart] : [dataPart]));
		},
	});

	// Auto-resume interrupted streams if the last message was from user
	const shouldAutoResume = initialMessages.length > 0 && initialMessages[initialMessages.length - 1]?.role === "user";

	useAutoResume({
		autoResume: shouldAutoResume,
		initialMessages,
		resumeStream,
		setMessages,
	});

	const handleSendMessage = async (message: string) => {
		if (!message.trim() || status === "streaming" || status === "submitted") return;

		// Update URL to include chat ID - following Vercel's pattern
		// Note: There may be a race condition where navigation happens before
		// messages are persisted by Mastra, causing empty initial state on refresh
		window.history.replaceState({}, "", `/chat/${agentId}/${threadId}`);

		try {
			// Generate UUID for the user message
			const userMessageId = uuidv4();

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

	// Always render the full chat interface if we have messages
	if (messages.length > 0) {
		return (
			<>
				<ChatMessages messages={messages} status={status} />
				<ChatBottomSection>
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Ask Lightfast"
						disabled={status === "streaming" || status === "submitted"}
					/>
				</ChatBottomSection>
			</>
		);
	}

	// For empty state, center the content in the middle of the page
	return (
		<div className="flex-1 flex items-center justify-center">
			<div className="w-full max-w-3xl px-4">
				<div className="px-4">
					<EmptyState />
				</div>
				<ChatInput
					onSendMessage={handleSendMessage}
					placeholder="Ask Lightfast"
					disabled={status === "streaming" || status === "submitted"}
				/>
			</div>
		</div>
	);
}
