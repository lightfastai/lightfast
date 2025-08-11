"use client";

import { useChat } from "@ai-sdk/react";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { useChatTransport } from "@/hooks/use-chat-transport";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { ChatMessages } from "./chat-messages";
import { EmptyState } from "./empty-state";

interface ChatInputSectionProps {
	agentId: string;
	threadId: string;
	initialMessages?: LightfastUIMessage[];
}

/**
 * Client component that handles chat interactivity
 * Isolated from server-rendered content for better performance
 */
export function ChatInputSection({ agentId, threadId, initialMessages = [] }: ChatInputSectionProps) {
	console.log("[ChatInputSection] Render with:", {
		agentId,
		threadId,
		initialMessagesCount: initialMessages.length,
		initialMessages: initialMessages.map((m) => ({ id: m.id, role: m.role, partsCount: m.parts?.length })),
	});

	// Create transport for AI SDK v5 with agentId
	const transport = useChatTransport({ threadId, agentId });

	// Auto-resume interrupted streams if the last message was from user
	const shouldAutoResume = initialMessages.length > 0 && initialMessages[initialMessages.length - 1]?.role === "user";

	// Use the chat hook with transport and LightfastUIMessage type
	// The key is to use a stable ID that includes both agentId and threadId
	// This ensures the hook creates a fresh instance for each new chat
	const {
		messages,
		sendMessage: vercelSendMessage,
		status,
	} = useChat<LightfastUIMessage>({
		id: `${agentId}-${threadId}`,
		transport,
		messages: initialMessages,
		onError: (error) => {
			console.error("Error streaming text:", error);
		},
		resume: shouldAutoResume,
	});

	console.log("[ChatInputSection] Current state:", {
		messagesCount: messages.length,
		status,
		messages: messages.map((m) => ({ id: m.id, role: m.role, partsCount: m.parts?.length })),
	});

	const handleSendMessage = async (message: string) => {
		console.log("[handleSendMessage] Called with:", { message, status, messagesCount: messages.length });

		if (!message.trim() || status === "streaming" || status === "submitted") return;

		// Update URL to include chat ID - following Vercel's pattern
		// Note: There may be a race condition where navigation happens before
		// messages are persisted, causing empty initial state on refresh
		window.history.replaceState({}, "", `/chat/${agentId}/${threadId}`);

		try {
			// Generate UUID for the user message
			const userMessageId = crypto.randomUUID();

			console.log("[handleSendMessage] Sending message with ID:", userMessageId);

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
				<div className="relative">
					{/* Chat Input container with gradient */}
					<div className="relative bg-background pb-4">
						<ChatInput
							onSendMessage={handleSendMessage}
							placeholder="Ask Lightfast"
							disabled={status === "streaming" || status === "submitted"}
							withGradient={true}
							withDescription="This is an experiment by Lightfast. Use with discretion."
						/>
					</div>
				</div>
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
