"use client";

import dynamic from "next/dynamic";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { PromptSuggestions } from "./prompt-suggestions";
import { useChat } from "@ai-sdk/react";
import React, { useState } from "react";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { useAnonymousMessageLimit } from "~/hooks/use-anonymous-message-limit";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useErrorBoundaryHandler } from "~/hooks/use-error-boundary-handler";
import { ChatErrorHandler } from "~/lib/errors/chat-error-handler";
import { ChatErrorType } from "~/lib/errors/types";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import type { ChatRouterOutputs } from "@api/chat";

// Dynamic imports for components that are conditionally rendered
const ProviderModelSelector = dynamic(
	() =>
		import("./provider-model-selector").then(
			(mod) => mod.ProviderModelSelector,
		),
	{ ssr: false },
);

const AuthPromptSelector = dynamic(
	() => import("./auth-prompt-selector").then((mod) => mod.AuthPromptSelector),
	{ ssr: false },
);

const RateLimitIndicator = dynamic(
	() => import("./rate-limit-indicator").then((mod) => mod.RateLimitIndicator),
	{ ssr: false },
);

const RateLimitDialog = dynamic(
	() => import("./rate-limit-dialog").then((mod) => mod.RateLimitDialog),
	{ ssr: false },
);

type UserInfo = ChatRouterOutputs["user"]["getUser"];

interface ChatInterfaceProps {
	agentId: string;
	sessionId: string;
	initialMessages: LightfastAppChatUIMessage[];
	isNewSession: boolean;
	handleSessionCreation: (firstMessage: string) => void; // Required - pass no-op function for scenarios where session creation isn't needed
	user: UserInfo | null; // null for unauthenticated users
	onNewUserMessage?: (userMessage: LightfastAppChatUIMessage) => void; // Optional callback when user sends a message
	onNewAssistantMessage?: (assistantMessage: LightfastAppChatUIMessage) => void; // Optional callback when AI finishes responding
}

export function ChatInterface({
	agentId,
	sessionId,
	initialMessages,
	isNewSession,
	handleSessionCreation,
	user,
	onNewUserMessage,
	onNewAssistantMessage,
}: ChatInterfaceProps) {
	// ALL errors now go to error boundary - no inline error state needed

	// Hook for handling ALL errors via error boundaries
	const { throwToErrorBoundary } = useErrorBoundaryHandler();
	// Derive authentication status from user presence
	const isAuthenticated = user !== null;

	// State for rate limit dialog
	const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);

	// Anonymous message limit tracking (only for unauthenticated users)
	const {
		messageCount,
		remainingMessages,
		incrementCount,
		hasReachedLimit,
		isLoading: isLimitLoading,
	} = useAnonymousMessageLimit();

	// Preload dialog image when user is close to limit (3 messages left)
	React.useEffect(() => {
		if (!isAuthenticated && remainingMessages <= 3 && remainingMessages > 0) {
			// Preload the image using Next.js Image preloader
			const img = new Image();
			img.src = "/og-bg-only.jpg";
		}
	}, [isAuthenticated, remainingMessages]);

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
		resumeStream,
	} = useChat<LightfastAppChatUIMessage>({
		id: `${agentId}-${sessionId}`,
		transport,
		experimental_throttle: 45,
		messages: initialMessages,
		onError: (error) => {
			// Extract the chat error information
			const chatError = ChatErrorHandler.handleError(error);

			// Define which errors are critical and should use error boundary
			// These are errors that prevent the chat from functioning
			const CRITICAL_ERROR_TYPES = [
				ChatErrorType.AUTHENTICATION,
				ChatErrorType.BOT_DETECTION,
				ChatErrorType.SECURITY_BLOCKED,
				ChatErrorType.MODEL_ACCESS_DENIED,
				// Rate limit is only critical for anonymous users
				...(isAuthenticated ? [] : [ChatErrorType.RATE_LIMIT]),
			];

			// Check if this is a critical error
			if (CRITICAL_ERROR_TYPES.includes(chatError.type)) {
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

				console.error("[Critical Error] Throwing to error boundary:", {
					type: chatError.type,
					statusCode: chatError.statusCode,
					message: chatError.message,
				});

				// Throw to error boundary with our extracted information
				throwToErrorBoundary(errorForBoundary);
			} else {
				// Non-critical errors (streaming, network, temporary server issues)
				// Log but don't crash the UI
				console.error("[Streaming Error] Non-critical error occurred:", {
					type: chatError.type,
					statusCode: chatError.statusCode,
					message: chatError.message,
					details: chatError.details,
				});

				// Could show a toast or inline message here
				// For now, just log and let the user retry
			}
		},
		onFinish: (event) => {
			// Pass the assistant message to the callback
			// This allows parent components to optimistically update the cache
			onNewAssistantMessage?.(event.message);
		},
	});

	// Auto-resume streaming if requested and there's an incomplete stream
	React.useEffect(() => {
		if (
			initialMessages.length > 0 &&
			initialMessages[initialMessages.length - 1]?.role === "user"
		) {
			void resumeStream();
		}
		// We want to disable the exhaustive deps rule here because we only want to run this effect once
	}, []);

	const handleSendMessage = async (message: string) => {
		if (!message.trim() || status === "streaming" || status === "submitted") {
			return;
		}

		// For unauthenticated users, check if they've reached the limit
		if (!isAuthenticated && hasReachedLimit) {
			// Show the sign-in dialog instead of throwing error
			setShowRateLimitDialog(true);
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

			// Create the user message object
			const userMessage: LightfastAppChatUIMessage = {
				role: "user",
				parts: [{ type: "text", text: message }],
				id: userMessageId,
			};

			// Call the callback to update cache BEFORE sending
			// This ensures the user message is in cache before assistant responds
			onNewUserMessage?.(userMessage);

			// Send message using Vercel's format
			await vercelSendMessage(userMessage, {
				body: {
					userMessageId,
					modelId: selectedModelId,
				},
			});

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
						disabled={status === "streaming" || status === "submitted"}
						modelSelector={modelSelector}
					/>
					{/* Prompt suggestions - only visible on iPad and above (md breakpoint) */}
					<div className="hidden md:block relative mt-4 h-12">
						<div className="absolute top-0 left-0 right-0 px-4">
							<PromptSuggestions onSelectPrompt={handleSendMessage} />
						</div>
					</div>
				</div>

				{/* Rate limit dialog - shown when anonymous user hits limit */}
				<RateLimitDialog
					open={showRateLimitDialog}
					onOpenChange={setShowRateLimitDialog}
				/>
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
						disabled={status === "streaming" || status === "submitted"}
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

			{/* Rate limit dialog - shown when anonymous user hits limit */}
			<RateLimitDialog
				open={showRateLimitDialog}
				onOpenChange={setShowRateLimitDialog}
			/>
		</div>
	);
}
