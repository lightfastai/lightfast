"use client";

import { AppEmptyState } from "@repo/ui/components/app-empty-state";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { ProviderModelSelector } from "./provider-model-selector";
import { RateLimitIndicator } from "./rate-limit-indicator";
import { useChat } from "@ai-sdk/react";
import React from "react";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { useAnonymousMessageLimit } from "~/hooks/use-anonymous-message-limit";
import { useModelSelection } from "~/hooks/use-model-selection";
import { ChatErrorHandler, type ChatError } from "~/lib/chat-error-handler";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import type { RouterOutputs } from "@vendor/trpc";

type UserInfo = RouterOutputs["auth"]["user"]["getUser"];

interface ChatInterfaceProps {
	agentId: string;
	sessionId: string;
	initialMessages: LightfastAppChatUIMessage[];
	isNewSession: boolean;
	handleSessionCreation: () => void; // Required - pass no-op function for scenarios where session creation isn't needed
	user: UserInfo | null; // null for unauthenticated users
	onFinish?: () => void; // Optional callback when AI finishes responding
}

export function ChatInterface({
	agentId,
	sessionId,
	initialMessages,
	isNewSession,
	handleSessionCreation,
	user,
	onFinish,
}: ChatInterfaceProps) {
	// State for error handling
	const [lastError, setLastError] = React.useState<ChatError | null>(null);
	const [failedMessageId, setFailedMessageId] = React.useState<string | null>(null);
	// Derive authentication status from user presence
	const isAuthenticated = user !== null;
	console.log('User data:', user);
	console.log('isAuthenticated:', isAuthenticated);

	// Anonymous message limit tracking (only for unauthenticated users)
	const {
		messageCount,
		remainingMessages,
		incrementCount,
		hasReachedLimit,
		isLoading: isLimitLoading,
	} = useAnonymousMessageLimit();

	// Model selection with persistence
	const { selectedModelId, handleModelChange } = useModelSelection(isAuthenticated);

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
			const chatError = ChatErrorHandler.handleError(error, {
				showToast: true,
				onRetry: () => {
					// Find last user message and retry
					const lastUserMessage = messages.filter(m => m.role === 'user').pop();
					if (lastUserMessage && lastUserMessage.parts[0]?.type === 'text') {
						handleSendMessage(lastUserMessage.parts[0].text);
					}
				},
			});
			
			// Store error for inline display if needed
			setLastError(chatError);
			
			// Mark the last message as failed if it was a user message
			const lastMessage = messages[messages.length - 1];
			if (lastMessage?.role === 'user') {
				setFailedMessageId(lastMessage.id);
			}
		},
		onFinish: () => {
			// Clear error state on successful completion
			setLastError(null);
			setFailedMessageId(null);
			onFinish?.();
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
			ChatErrorHandler.handleError(
				new Error("Daily message limit reached"),
				{
					showToast: true,
					customMessage: "Message limit reached",
				}
			);
			return;
		}

		try {
			// Call handleSessionCreation when this is the first message in a new session
			// Only call when this is truly the first message (no existing messages)
			// Fires optimistically - backend will handle session creation if needed
			if (isNewSession && messages.length === 0) {
				handleSessionCreation();
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
			ChatErrorHandler.handleError(error, {
				showToast: true,
				customMessage: "Failed to send message",
			});
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
							prompt={
								user?.email
									? `Welcome back, ${user.email}`
									: "What can I do for you?"
							}
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
					/>
				</div>
			</div>
		);
	}

	// Thread view or chat with existing messages
	return (
		<div className="flex flex-col h-full">
			<ChatMessages 
				messages={messages} 
				status={status}
				error={lastError}
				failedMessageId={failedMessageId}
				onRetry={() => {
					if (lastError?.action) {
						lastError.action();
					}
				}}
			/>
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
						withDescription={messages.length > 0 ? "Lightfast may make mistakes. Use with discretion." : undefined}
						modelSelector={modelSelector}
					/>
				</div>
			</div>
		</div>
	);
}
