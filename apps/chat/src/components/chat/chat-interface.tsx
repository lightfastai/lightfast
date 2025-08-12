"use client";

import { AppEmptyState } from "@repo/ui/components/app-empty-state";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { ProviderModelSelector } from "./provider-model-selector";
import { RateLimitIndicator } from "./rate-limit-indicator";
import { useChat } from "@ai-sdk/react";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { useAnonymousMessageLimit } from "~/hooks/use-anonymous-message-limit";
import { showAIErrorToast } from "~/lib/ai-errors";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { getDefaultModelForUser } from "~/lib/ai/providers";
import type { ModelId } from "~/lib/ai/providers";
import { useState, useCallback, useEffect } from "react";

interface ChatInterfaceProps {
	agentId: string;
	sessionId: string; // Either a client-generated UUID for new sessions or actual session ID for existing ones
	initialMessages?: LightfastAppChatUIMessage[];
	isNewSession?: boolean; // Indicates if this is a new session that needs to be created
	onFirstMessage?: () => void; // Optional callback for when the first message is sent (used for session creation in authenticated mode)
}

export function ChatInterface({
	agentId,
	sessionId,
	initialMessages = [],
	isNewSession = false,
	onFirstMessage,
}: ChatInterfaceProps) {
	// Check if user is authenticated (presence of onFirstMessage indicates authenticated mode)
	const isAuthenticated = !!onFirstMessage;

	// Anonymous message limit tracking (only for unauthenticated users)
	const {
		messageCount,
		remainingMessages,
		incrementCount,
		hasReachedLimit,
		isLoading: isLimitLoading,
	} = useAnonymousMessageLimit();

	// Model selection state - default based on authentication
	const defaultModel = getDefaultModelForUser(isAuthenticated);
	const [selectedModelId, setSelectedModelId] =
		useState<ModelId>(defaultModel);

	// Load persisted model selection after mount
	useEffect(() => {
		const storedModel = sessionStorage.getItem("selectedModelId");
		if (storedModel) {
			setSelectedModelId(storedModel as ModelId);
		} else {
			// If no stored model, use the appropriate default for the user's auth status
			setSelectedModelId(defaultModel);
		}
	}, [defaultModel]);

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
		agentId,
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

		// For unauthenticated users, check if they've reached the limit
		if (!isAuthenticated && hasReachedLimit) {
			showAIErrorToast(
				new Error("Daily message limit reached. Please sign in to continue."),
				"Message limit reached",
			);
			return;
		}

		try {
			// Call the onFirstMessage callback if provided (for authenticated mode session creation)
			// Only call when this is truly the first message (no existing messages)
			// Fires optimistically - backend will handle session creation if needed
			if (onFirstMessage && isNewSession && messages.length === 0) {
				onFirstMessage();
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

			// Increment count for anonymous users after successful send
			if (!isAuthenticated) {
				incrementCount();
			}
		} catch (error) {
			showAIErrorToast(error, "Failed to send message");
		}
	};

	// Create model selector component
	const modelSelector = (
		<ProviderModelSelector
			value={selectedModelId}
			onValueChange={handleModelChange}
			disabled={false} // Allow model selection even during streaming
			isAuthenticated={isAuthenticated}
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
						disabled={
							status === "streaming" ||
							status === "submitted" ||
							(!isAuthenticated && hasReachedLimit)
						}
						modelSelector={modelSelector}
						withDescription="Lightfast may make mistakes. Use with discretion."
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
					{/* Show rate limit indicator for anonymous users - only shows when messages exist (not on new chat) */}
					{!isAuthenticated && !isLimitLoading && messageCount > 0 && (
						<div className="mb-2 px-4">
							<RateLimitIndicator remainingMessages={remainingMessages} />
						</div>
					)}
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Continue the conversation..."
						disabled={
							status === "streaming" ||
							status === "submitted" ||
							(!isAuthenticated && hasReachedLimit)
						}
						withGradient={isAuthenticated}
						withDescription="Lightfast may make mistakes. Use with discretion."
						modelSelector={modelSelector}
					/>
				</div>
			</div>
		</div>
	);
}
