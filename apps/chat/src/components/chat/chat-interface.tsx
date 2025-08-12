"use client";

import { AppEmptyState } from "@repo/ui/components/app-empty-state";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { ProviderModelSelector } from "./provider-model-selector";
import { useChat } from "@ai-sdk/react";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { useCreateSession } from "~/hooks/use-create-session";
import { showAIErrorToast } from "~/lib/ai-errors";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { DEFAULT_MODEL_ID  } from "~/lib/ai/providers";
import type {ModelId} from "~/lib/ai/providers";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ChatInterfaceProps {
	agentId: string;
	sessionId: string; // Either a client-generated UUID for new sessions or actual session ID for existing ones
	initialMessages?: LightfastAppChatUIMessage[];
	isNewSession?: boolean; // Indicates if this is a new session that needs to be created
}

export function ChatInterface({
	agentId,
	sessionId,
	initialMessages = [],
	isNewSession = false,
}: ChatInterfaceProps) {
	// Model selection state
	const [selectedModelId, setSelectedModelId] = useState<ModelId>(DEFAULT_MODEL_ID);
	
	// Hook for creating sessions optimistically
	const createSession = useCreateSession();

	// Load persisted model selection after mount
	useEffect(() => {
		const storedModel = sessionStorage.getItem("selectedModelId");
		if (storedModel) {
			setSelectedModelId(storedModel as ModelId);
		}
	}, []);

	// Handle model selection change
	const handleModelChange = useCallback((value: ModelId) => {
		setSelectedModelId(value);
		// Persist to sessionStorage to maintain selection across navigation
		if (typeof window !== "undefined") {
			sessionStorage.setItem("selectedModelId", value);
		}
	}, []);

	// Create transport for AI SDK v5
	// Uses sessionId directly as the primary key
	const transport = useChatTransport({ 
		sessionId: sessionId, 
		agentId 
	});

	// Use Vercel's useChat directly with transport
	const {
		messages,
		sendMessage: vercelSendMessage,
		status,
	} = useChat<LightfastAppChatUIMessage>({
		id: `${agentId}-${sessionId}`,
		transport,
		messages: initialMessages,
		onError: (error) => {
			showAIErrorToast(error, "Chat error occurred");
		},
		resume:
			initialMessages.length > 0 &&
			initialMessages[initialMessages.length - 1]?.role === "user",
	});

	const handleSendMessage = async (message: string) => {
		if (!message.trim() || status === "streaming" || status === "submitted") {
			return;
		}

		try {
			// If this is a new session, create it first before sending the message
			// This ensures the session exists in the database before messages are added
			if (isNewSession) {
				// Update the URL immediately for instant feedback
				window.history.replaceState({}, "", `/${sessionId}`);
				
				// Create the session using mutate (fire and forget)
				// The mutation has optimistic updates so UI will update immediately
				// The unique constraint in the database will prevent duplicate sessions
				createSession.mutate({ id: sessionId });
			} else {
				// For existing sessions, just update the URL to ensure consistency
				window.history.replaceState({}, "", `/${sessionId}`);
			}

			// Generate UUID for the user message
			const userMessageId = crypto.randomUUID();

			// Send message using Vercel's format
			await vercelSendMessage(
				{
					role: "user",
					parts: [{ type: "text", text: message }],
					id: userMessageId,
				},
				{
					body: {
						userMessageId,
						modelId: selectedModelId,
					},
				},
			);
		} catch (error) {
			showAIErrorToast(error, "Failed to send message");
		}
	};

	// Create model selector component
	const modelSelector = (
		<ProviderModelSelector
			value={selectedModelId}
			onValueChange={handleModelChange}
			disabled={status === "streaming" || status === "submitted"}
		/>
	);

	// For new chats (no messages yet), show centered layout
	if (messages.length === 0) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="w-full max-w-3xl px-4">
					<div className="px-4">
						<AppEmptyState
							title="Chat"
							description="Experience the power of Lightfast AI. Start chatting to explore."
						/>
					</div>
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Ask anything..."
						disabled={status === "streaming" || status === "submitted"}
						modelSelector={modelSelector}
					/>
				</div>
			</div>
		);
	}

	// Thread view or chat with existing messages
	return (
		<div className="flex flex-col h-full">
			<ChatMessages messages={messages} status={status} />
			<div className="relative bg-background">
				<div className="max-w-3xl mx-auto p-4">
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Continue the conversation..."
						disabled={status === "streaming" || status === "submitted"}
						withGradient={true}
						withDescription="Chat with Lightfast AI"
						modelSelector={modelSelector}
					/>
				</div>
			</div>
		</div>
	);
}