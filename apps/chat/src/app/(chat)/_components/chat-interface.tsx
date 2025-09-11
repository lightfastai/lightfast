"use client";

import dynamic from "next/dynamic";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessages } from "./chat-messages";
import { PromptSuggestions } from "./prompt-suggestions";
import {
	PromptInput,
	PromptInputBody,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
	PromptInputSubmit,
	PromptInputButton,
	type PromptInputMessage,
} from "@repo/ui/components/ai-elements/prompt-input";
import type { FormEvent } from "react";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUp, Globe, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import React, { useState, useRef } from "react";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { useAnonymousMessageLimit } from "~/hooks/use-anonymous-message-limit";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useErrorBoundaryHandler } from "~/hooks/use-error-boundary-handler";
import { ChatErrorHandler } from "~/lib/errors/chat-error-handler";
import { ChatErrorType } from "~/lib/errors/types";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import type { ChatRouterOutputs } from "@api/chat";
import { useDataStream } from "~/hooks/use-data-stream";
import { ArtifactViewer, useArtifact } from "~/components/artifacts";
import { useArtifactStreaming } from "~/hooks/use-artifact-streaming";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@repo/ui/components/ui/button";
import { useFeedbackQuery } from "~/hooks/use-feedback-query";
import { useFeedbackMutation } from "~/hooks/use-feedback-mutation";

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

	// Clean artifact fetcher using our new REST API
	const fetchArtifact = async (artifactId: string) => {
		const response = await fetch(`/api/artifact?id=${artifactId}`);

		if (!response.ok) {
			// Handle specific error cases
			if (response.status === 401) {
				throw new Error("Authentication required to access artifacts");
			}
			if (response.status === 404) {
				throw new Error("Artifact not found");
			}

			const errorData = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new Error(
				errorData.error || `HTTP ${response.status}: ${response.statusText}`,
			);
		}

		return response.json();
	};

	// Data stream for artifact handling
	const { setDataStream } = useDataStream();

	// Artifact state management
	const {
		artifact,
		metadata,
		setMetadata,
		showArtifact,
		hideArtifact,
		updateArtifactContent,
		setArtifact,
	} = useArtifact();

	// Connect streaming data to artifact updates
	useArtifactStreaming({
		showArtifact,
		hideArtifact,
		updateArtifactContent,
		setArtifact,
		setMetadata,
	});

	// State for rate limit dialog
	const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);

	// Form refs for clearing after submission
	const promptFormRef1 = useRef<HTMLFormElement>(null);
	const promptFormRef2 = useRef<HTMLFormElement>(null);

	// Web search toggle state
	const [webSearchEnabled, setWebSearchEnabled] = useState(false);

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

	// Fetch feedback for this session
	const { data: feedback } = useFeedbackQuery({
		sessionId,
	});

	// Feedback mutation hooks
	const feedbackMutation = useFeedbackMutation();

	// Create transport for AI SDK v5
	// Uses sessionId directly as the primary key
	const transport = useChatTransport({
		sessionId: sessionId,
		agentId,
		webSearchEnabled,
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
		onData: (dataPart) => {
			// Accumulate streaming data parts for artifact processing
			setDataStream((ds) => (ds ? [...ds, dataPart] : [dataPart]));
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
					webSearchEnabled,
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

	// Handle prompt input submission - converts PromptInput format to our handleSendMessage
	const handlePromptSubmit = async (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
		formRef?: React.RefObject<HTMLFormElement>,
	) => {
		event.preventDefault();

		if (!message.text?.trim()) {
			return;
		}

		try {
			// Convert to our existing handleSendMessage format
			await handleSendMessage(message.text);
			
			// Clear the form after successful submission
			if (formRef?.current) {
				formRef.current.reset();
			}
		} catch (error) {
			// Let the parent component handle the error
			throw error;
		}
	};

	// Handle prompt input errors
	const handlePromptError = (error: {
		code: "max_files" | "max_file_size" | "accept";
		message: string;
	}) => {
		console.error("Prompt input error:", error);
		// Could integrate with toast system here if needed
	};

	// Handle feedback submission
	const handleFeedbackSubmit = (
		messageId: string,
		feedbackType: "upvote" | "downvote",
	) => {
		feedbackMutation.submit.mutate({
			sessionId,
			messageId,
			feedbackType,
		});
	};

	// Handle feedback removal
	const handleFeedbackRemove = (messageId: string) => {
		feedbackMutation.remove.mutate({
			sessionId,
			messageId,
		});
	};

	// Demo function to show artifact with mock data
	const showArtifactDemo = () => {
		showArtifact({
			documentId: "demo-artifact",
			title: "Interactive Code Demo",
			kind: "code",
			content: `console.log('Hello from Lightfast!');

// This is a demo artifact showing how code
// can be streamed and displayed alongside chat
function greet(name) {
  return \`Hello, \${name}! Welcome to Lightfast.\`;
}

const message = greet('Developer');
console.log(message);`,
			status: "idle",
			boundingBox: {
				top: 100,
				left: 100,
				width: 300,
				height: 200,
			},
		});
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

	// Create the main chat content component
	const chatContent =
		messages.length === 0 ? (
			// For new chats (no messages yet), show centered layout
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
					<PromptInput
						onSubmit={(message, event) => handlePromptSubmit(message, event, promptFormRef1)}
						onError={handlePromptError}
						ref={promptFormRef1}
						className={cn(
							"w-full border dark:shadow-md border-border/50 rounded-2xl overflow-hidden transition-all bg-input-bg dark:bg-input-bg",
							"!divide-y-0 !shadow-sm"
						)}
					>
						<PromptInputBody className="flex flex-col">
							<div className="flex-1 max-h-[180px] overflow-y-auto scrollbar-thin">
								<PromptInputTextarea
									placeholder="Ask anything..."
									className={cn(
										"w-full resize-none border-0 rounded-none focus-visible:ring-0 whitespace-pre-wrap break-words p-3",
										"!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg",
										"outline-none min-h-0 min-h-[72px]"
									)}
									style={{ lineHeight: "24px" }}
									maxLength={4000}
								/>
							</div>
							<PromptInputToolbar className="flex items-center justify-between p-2 bg-input-bg dark:bg-input-bg transition-[color,box-shadow]">
								{/* Left side tools */}
								<div className="flex items-center gap-2">
									<PromptInputButton
										variant={webSearchEnabled ? "secondary" : "outline"}
										onClick={() => setWebSearchEnabled(!webSearchEnabled)}
										className={cn(
											webSearchEnabled && "bg-secondary text-secondary-foreground hover:bg-secondary/80"
										)}
									>
										<Globe className="w-4 h-4" />
										Search
										{webSearchEnabled && (
											<X 
												className="w-3 h-3 ml-1 hover:opacity-70 cursor-pointer" 
												onClick={(e) => {
													e.stopPropagation();
													setWebSearchEnabled(false);
												}}
											/>
										)}
									</PromptInputButton>
								</div>
								
								{/* Right side tools */}
								<PromptInputTools className="flex items-center gap-2">
									{modelSelector}
									<PromptInputSubmit
										status={status}
										disabled={status === "streaming" || status === "submitted"}
										size="icon"
										variant="outline"
										className="h-8 w-8 dark:border-border/50 rounded-full dark:shadow-sm"
									>
										<ArrowUp className="w-4 h-4" />
									</PromptInputSubmit>
								</PromptInputTools>
							</PromptInputToolbar>
						</PromptInputBody>
					</PromptInput>
					{/* Prompt suggestions - only visible on iPad and above (md breakpoint) */}
					<div className="hidden md:block relative mt-4 h-12">
						<div className="absolute top-0 left-0 right-0 px-4">
							<PromptSuggestions onSelectPrompt={handleSendMessage} />
						</div>
					</div>
				</div>
			</div>
		) : (
			// Thread view or chat with existing messages
			<div className="flex flex-col h-full bg-background">
				<ChatMessages
					messages={messages}
					status={status}
					feedback={feedback}
					onFeedbackSubmit={handleFeedbackSubmit}
					onFeedbackRemove={handleFeedbackRemove}
					onArtifactClick={async (artifactId) => {
						try {
							// Fetch artifact data using clean REST API
							const artifactData = await fetchArtifact(artifactId);

							// Show the artifact with the fetched data
							showArtifact({
								documentId: artifactData.id,
								title: artifactData.title,
								kind: artifactData.kind,
								content: artifactData.content,
								status: "idle",
								boundingBox: {
									top: 100,
									left: 100,
									width: 300,
									height: 200,
								},
							});
						} catch (error) {
							// Clean error handling with user-friendly messages
							const errorMessage =
								error instanceof Error
									? error.message
									: "Unknown error occurred";
							console.error("Artifact fetch failed:", errorMessage);

							// Could optionally show toast notification here
							// toast.error(`Failed to load artifact: ${errorMessage}`);
						}
					}}
				/>
				<div className="relative">
					<div className="max-w-3xl mx-auto p-4">
						{/* Show rate limit indicator for anonymous users - only shows when messages exist (not on new chat) */}
						{!isAuthenticated && !isLimitLoading && messageCount > 0 && (
							<div className="mb-2 px-4">
								<RateLimitIndicator remainingMessages={remainingMessages} />
							</div>
						)}

						<div className="flex-shrink-0">
							<div className="chat-container relative">
								{/* Gradient overlay */}
								{isAuthenticated && (
									<div className="absolute -top-24 left-0 right-0 h-24 pointer-events-none">
										<div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
									</div>
								)}

								<PromptInput
									onSubmit={(message, event) => handlePromptSubmit(message, event, promptFormRef2)}
									onError={handlePromptError}
									ref={promptFormRef2}
									className={cn(
										"w-full border dark:shadow-md border-border/50 rounded-2xl overflow-hidden transition-all bg-input-bg dark:bg-input-bg",
										"!divide-y-0 !shadow-sm"
									)}
								>
									<PromptInputBody className="flex flex-col">
										<div className="flex-1 max-h-[180px] overflow-y-auto scrollbar-thin">
											<PromptInputTextarea
												placeholder="Continue the conversation..."
												className={cn(
													"w-full resize-none border-0 rounded-none focus-visible:ring-0 whitespace-pre-wrap break-words p-3",
													"!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg",
													"outline-none min-h-0 min-h-[72px]"
												)}
												style={{ lineHeight: "24px" }}
												maxLength={4000}
											/>
										</div>
										<PromptInputToolbar className="flex items-center justify-between p-2 bg-input-bg dark:bg-input-bg transition-[color,box-shadow]">
											{/* Left side tools */}
											<div className="flex items-center gap-2">
												<PromptInputButton
													variant={webSearchEnabled ? "secondary" : "outline"}
													onClick={() => setWebSearchEnabled(!webSearchEnabled)}
													className={cn(
														webSearchEnabled && "bg-secondary text-secondary-foreground hover:bg-secondary/80"
													)}
												>
													<Globe className="w-4 h-4" />
													Search
													{webSearchEnabled && (
														<X 
															className="w-3 h-3 ml-1 hover:opacity-70 cursor-pointer" 
															onClick={(e) => {
																e.stopPropagation();
																setWebSearchEnabled(false);
															}}
														/>
													)}
												</PromptInputButton>
											</div>
											
											{/* Right side tools */}
											<PromptInputTools className="flex items-center gap-2">
												{modelSelector}
												<PromptInputSubmit
													status={status}
													disabled={status === "streaming" || status === "submitted"}
													size="icon"
													variant="outline"
													className="h-8 w-8 dark:border-border/50 rounded-full dark:shadow-sm"
												>
													<ArrowUp className="w-4 h-4" />
												</PromptInputSubmit>
											</PromptInputTools>
										</PromptInputToolbar>
									</PromptInputBody>
								</PromptInput>
							</div>

							{/* Description text */}
							{messages.length > 0 && (
								<div className="chat-container">
									<p className="text-xs text-muted-foreground text-center mt-2">
										Lightfast may make mistakes. Use with discretion.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		);

	// Return the full layout with artifact support
	return (
		<div className="flex h-screen w-full overflow-hidden">
			{/* Chat interface - animates width when artifact is visible */}
			<motion.div
				className="min-w-0 flex-shrink-0"
				initial={false}
				animate={{
					width: artifact.isVisible ? "50%" : "100%",
				}}
				transition={{
					type: "spring",
					stiffness: 300,
					damping: 30,
					duration: 0.4,
				}}
			>
				{chatContent}
			</motion.div>

			{/* Artifact panel - slides in from right when visible */}
			<AnimatePresence>
				{artifact.isVisible && (
					<motion.div
						className="w-1/2 min-w-0 flex-shrink-0 relative z-50"
						initial={{ x: "100%", opacity: 0 }}
						animate={{
							x: 0,
							opacity: 1,
						}}
						exit={{
							x: "100%",
							opacity: 0,
						}}
						transition={{
							type: "spring",
							stiffness: 300,
							damping: 30,
							duration: 0.4,
						}}
					>
						<ArtifactViewer
							artifact={artifact}
							metadata={metadata}
							setMetadata={setMetadata}
							onClose={hideArtifact}
							onSaveContent={(content) => {
								// For demo purposes, just log the content
								console.log("Artifact content updated:", content);
							}}
							sessionId={sessionId}
							onArtifactSelect={async (artifactId) => {
								try {
									// Fetch artifact data using clean REST API
									const artifactData = await fetchArtifact(artifactId);

									// Show the artifact with the fetched data
									showArtifact({
										documentId: artifactData.id,
										title: artifactData.title,
										kind: artifactData.kind,
										content: artifactData.content,
										status: "idle",
										boundingBox: {
											top: 100,
											left: 100,
											width: 300,
											height: 200,
										},
									});
								} catch (error) {
									console.error("Failed to load artifact:", error);
									// Could add toast notification here
								}
							}}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Demo button when no artifact is shown */}
			{!artifact.isVisible && (
				<div className="fixed bottom-4 right-4">
					<Button onClick={showArtifactDemo} className="z-50">
						🧪 Show Artifact Demo
					</Button>
				</div>
			)}

			{/* Rate limit dialog - shown when anonymous user hits limit */}
			<RateLimitDialog
				open={showRateLimitDialog}
				onOpenChange={setShowRateLimitDialog}
			/>
		</div>
	);
}
