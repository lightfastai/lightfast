"use client";

import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { ProviderModelSelector } from "./provider-model-selector";
import { AuthPromptSelector } from "./auth-prompt-selector";
import { RateLimitIndicator } from "./rate-limit-indicator";
import { PromptSuggestions } from "./prompt-suggestions";
import { useChat } from "@ai-sdk/react";
import React from "react";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { useAnonymousMessageLimit } from "~/hooks/use-anonymous-message-limit";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useErrorBoundaryHandler } from "~/hooks/use-error-boundary-handler";
import { ChatErrorHandler } from "~/lib/errors/chat-error-handler";
import type { ChatErrorType } from "~/lib/errors/types";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import type { RouterOutputs } from "@vendor/trpc";

type UserInfo = RouterOutputs["auth"]["user"]["getUser"];

interface ChatInterfaceProps {
	agentId: string;
	sessionId: string;
	initialMessages: LightfastAppChatUIMessage[];
	isNewSession: boolean;
	handleSessionCreation: (firstMessage: string) => void; // Required - pass no-op function for scenarios where session creation isn't needed
	user: UserInfo | null; // null for unauthenticated users
	onFinish?: (assistantMessage: LightfastAppChatUIMessage, allMessages: LightfastAppChatUIMessage[]) => void; // Optional callback when AI finishes responding
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
	// ALL errors now go to error boundary - no inline error state needed

	// Hook for handling ALL errors via error boundaries
	const { throwToErrorBoundary } = useErrorBoundaryHandler();
	// Derive authentication status from user presence
	const isAuthenticated = user !== null;
	console.log("User data:", user);
	console.log("isAuthenticated:", isAuthenticated);

	// Anonymous message limit tracking (only for unauthenticated users)
	const {
		messageCount,
		remainingMessages,
		incrementCount,
		hasReachedLimit,
		isLoading: isLimitLoading,
	} = useAnonymousMessageLimit();

	// Model selection with persistence
	const { selectedModelId, handleModelChange } =
		useModelSelection(isAuthenticated);

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
			// ALL errors from API go to error boundary
			// Extract the chat error information
			const chatError = ChatErrorHandler.handleError(error);

			// Create an error with our extracted information
			// This ensures the error boundary gets the right status code
			interface EnhancedError extends Error {
				statusCode?: number;
				type?: ChatErrorType;
				details?: string;
				metadata?: Record<string, unknown>;
			}
			const errorForBoundary = new Error(chatError.message) as EnhancedError;
			errorForBoundary.statusCode = chatError.statusCode;
			errorForBoundary.type = chatError.type;
			errorForBoundary.details = chatError.details;
			errorForBoundary.metadata = chatError.metadata;

			// Throw to error boundary with our extracted information
			throwToErrorBoundary(errorForBoundary);
		},
		onFinish: (event) => {
			// Pass the assistant message and all messages to the onFinish callback
			// This allows parent components to optimistically update the cache
			onFinish?.(event.message, messages);
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
			// This is a client-side check - throw to error boundary
			interface LimitError extends Error {
				statusCode?: number;
			}
			const limitError = new Error("Daily message limit reached") as LimitError;
			limitError.statusCode = 429;
			throwToErrorBoundary(limitError);
			return;
		}

		try {
			// Call handleSessionCreation when this is the first message in a new session
			// Only call when this is truly the first message (no existing messages)
			// Fires optimistically - backend will handle session creation if needed
			if (isNewSession && messages.length === 0) {
				handleSessionCreation(message);
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
			// Log and throw to error boundary
			ChatErrorHandler.handleError(error);
			throwToErrorBoundary(error);
		}
	};

	// Create model selector component - show auth prompt for unauthenticated users
	const modelSelector = isAuthenticated ? (
		<ProviderModelSelector
			value={selectedModelId}
			onValueChange={handleModelChange}
			disabled={false} // Allow model selection even during streaming
			isAuthenticated={isAuthenticated}
		/>
	) : (
		<AuthPromptSelector />
	);

	// For new chats (no messages yet), show centered layout
	if (messages.length === 0) {
		return (
			<div className="h-full flex flex-col items-center justify-center bg-background">
				<div className="w-full max-w-3xl px-4">
					<div className="px-4 mb-8">
						<ChatEmptyState
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
					{/* Prompt suggestions - only visible on iPad and above (md breakpoint) */}
					<div className="hidden md:block relative mt-4 h-12">
						<div className="absolute top-0 left-0 right-0 px-4">
							<PromptSuggestions onSelectPrompt={handleSendMessage} />
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Thread view or chat with existing messages
	return (
		<div className="flex flex-col h-full bg-background">
			<ChatMessages messages={messages} status={status} />
			<div className="relative">
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
						withDescription={
							messages.length > 0
								? "Lightfast may make mistakes. Use with discretion."
								: undefined
						}
						modelSelector={modelSelector}
					/>
				</div>
			</div>
		</div>
	);
}
