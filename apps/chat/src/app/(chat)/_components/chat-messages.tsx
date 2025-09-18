"use client";

import type { ChatStatus, ToolUIPart } from "ai";
import { Fragment, memo, useMemo, useRef, useEffect } from "react";
import { ToolCallRenderer } from "./tool-call-renderer";
import { SineWaveDots } from "~/components/sine-wave-dots";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import type { CitationSource } from "@repo/ui/lib/citation-parser";
import {
	parseResponseMetadata,
	cleanTextFromMetadata,
} from "~/ai/prompts/parsers/metadata-parser";
import {
	InlineCitationCard,
	InlineCitationCardTrigger,
	InlineCitationCardBody,
	InlineCitationCarousel,
	InlineCitationCarouselContent,
	InlineCitationCarouselItem,
	InlineCitationCarouselHeader,
	InlineCitationCarouselIndex,
	InlineCitationCarouselPrev,
	InlineCitationCarouselNext,
	InlineCitationSource,
} from "@repo/ui/components/ai-elements/inline-citation";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@repo/ui/components/ai-elements/reasoning";

import {
	isReasoningPart,
	isTextPart,
	isToolPart,
} from "~/ai/lightfast-app-chat-ui-messages";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@repo/ui/components/ai-elements/conversation";
import {
	Message,
	MessageContent,
} from "@repo/ui/components/ai-elements/message";
import { Response } from "@repo/ui/components/ai-elements/response";
import { Actions, Action } from "@repo/ui/components/ai-elements/actions";
import {
	Copy,
	ThumbsUp,
	ThumbsDown,
	Check,
	AlertCircle,
	X,
} from "lucide-react";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";
import { useStream } from "~/hooks/use-stream";
import { cn } from "@repo/ui/lib/utils";
import type { ChatInlineError } from "./chat-inline-error";
import { ChatErrorType } from "~/lib/errors/types";

// Stable sine wave component that persists during streaming
const StreamingSineWave = memo(function StreamingSineWave({
	show,
}: {
	show: boolean;
}) {
	if (!show) return null;

	return (
		<div className="w-full">
			<SineWaveDots />
		</div>
	);
});

interface ChatMessagesProps {
	messages: LightfastAppChatUIMessage[];
	status: ChatStatus;
	onArtifactClick?: (artifactId: string) => void;
	feedback?: Record<string, "upvote" | "downvote">;
	onFeedbackSubmit?: (
		messageId: string,
		feedbackType: "upvote" | "downvote",
	) => void;
	onFeedbackRemove?: (messageId: string) => void;
	_isAuthenticated: boolean;
	isExistingSessionWithNoMessages?: boolean;
	hasActiveStream?: boolean;
	inlineErrors?: ChatInlineError[];
	onInlineErrorDismiss?: (errorId: string) => void;
}

// Helper to check if message has meaningful streaming content
const hasMeaningfulContent = (message: LightfastAppChatUIMessage): boolean => {
	return message.parts.some((part) => {
		if (isTextPart(part) && part.text.trim().length > 1) return true;
		if (isToolPart(part)) return true;
		if (isReasoningPart(part) && part.text.trim().length > 1) return true;
		return false;
	});
};

const StreamingResponse = memo(function StreamingResponse({
	text,
	animate,
	className,
}: {
	text: string;
	animate: boolean;
	className?: string;
}) {
	const contentRef = useRef("");
	const { stream, addPart } = useStream();

	useEffect(() => {
		if (!text || !animate) return;

		if (contentRef.current !== text) {
			const delta = text.slice(contentRef.current.length);
			if (delta) {
				addPart(delta);
			}
			contentRef.current = text;
		}
	}, [text, animate, addPart]);

	if (!animate) return <Response className={className}>{text}</Response>;

	return <Response className={className}>{stream || text}</Response>;
});

const getRecordString = (record: unknown, key: string): string | undefined => {
	if (!record || typeof record !== "object") return undefined;
	const value = (record as Record<string, unknown>)[key];
	return typeof value === "string" ? value : undefined;
};

const AssistantTextPart = memo(function AssistantTextPart({
	cleanedText,
	shouldAnimate,
}: {
	cleanedText: string;
	shouldAnimate: boolean;
}) {
	return (
		<MessageContent variant="chat" className="w-full py-0">
			<StreamingResponse text={cleanedText} animate={shouldAnimate} />
		</MessageContent>
	);
});

const AssistantReasoningPart = memo(function AssistantReasoningPart({
	reasoningText,
	isStreaming,
}: {
	reasoningText: string;
	isStreaming: boolean;
}) {
	return (
		<div className="w-full">
			<Reasoning className="w-full" isStreaming={isStreaming}>
				<ReasoningTrigger />
				<ReasoningContent>{reasoningText}</ReasoningContent>
			</Reasoning>
		</div>
	);
});

const getInlineErrorCopy = (
	inlineError: ChatInlineError,
): { title: string; message: string } => {
	const { error } = inlineError;
	const metadataCategory = getRecordString(error.metadata, "category");
	const category = inlineError.category ?? error.category ?? metadataCategory;
	const defaultMessage = error.message;
	let title = "Something went wrong";
	let message = defaultMessage;

	if (category === "persistence") {
		title = "Response not saved";
		message =
			"We streamed a reply but failed to store it. Copy anything important before refreshing.";
		return { title, message };
	}

	if (category === "resume") {
		title = "Resume temporarily unavailable";
		message =
			"We couldn't keep this response resumable. Refreshing may interrupt the live stream.";
		return { title, message };
	}

	if (category === "stream" && error.type === ChatErrorType.SERVER_ERROR) {
		title = "We couldn't finish that response";
		return { title, message };
	}

	switch (error.type) {
		case ChatErrorType.RATE_LIMIT:
			title = "We're a bit busy";
			break;
		case ChatErrorType.USAGE_LIMIT_EXCEEDED:
			title = "Usage limit reached";
			break;
		case ChatErrorType.AUTHENTICATION:
			title = "Sign in to continue";
			break;
		case ChatErrorType.MODEL_ACCESS_DENIED:
			title = "Model not available";
			break;
		case ChatErrorType.MODEL_UNAVAILABLE:
			title = "Model unavailable";
			break;
		case ChatErrorType.SERVICE_UNAVAILABLE:
			title = "Service unavailable";
			break;
		case ChatErrorType.SECURITY_BLOCKED:
		case ChatErrorType.BOT_DETECTION:
			title = "Request blocked";
			break;
		case ChatErrorType.NETWORK:
		case ChatErrorType.TIMEOUT:
			title = "Connection issue";
			break;
		case ChatErrorType.INVALID_REQUEST:
			title = "Invalid request";
			break;
	}

	return { title, message };
};

const InlineErrorCard = memo(function InlineErrorCard({
	inlineError,
	onDismiss,
}: {
	inlineError: ChatInlineError;
	onDismiss?: (errorId: string) => void;
}) {
	const { errorCode } = inlineError;
	const detail = inlineError.error.details;
	const { title, message } = getInlineErrorCopy(inlineError);

	return (
		<div className="relative flex w-full items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground">
			<AlertCircle className="mt-1 h-4 w-4 shrink-0" />
			<div className="flex-1 space-y-2">
				<p className="font-semibold leading-5">{title}</p>
				<p className="leading-relaxed text-destructive-foreground/90">
					{message}
				</p>
				{detail && (
					<p className="text-xs text-destructive-foreground/80">{detail}</p>
				)}
				{errorCode && (
					<p className="text-[11px] uppercase tracking-wide text-destructive-foreground/60">
						Error code: {errorCode}
					</p>
				)}
			</div>
			{onDismiss && (
				<button
					type="button"
					className="absolute top-3 right-3 rounded-full p-1 text-destructive-foreground transition hover:bg-destructive/20"
					onClick={() => onDismiss(inlineError.id)}
					aria-label="Dismiss chat error"
				>
					<X className="h-4 w-4" />
				</button>
			)}
		</div>
	);
});

type AssistantTurn =
	| {
			kind: "answer";
			user: LightfastAppChatUIMessage;
			assistant: LightfastAppChatUIMessage;
			isStreaming: boolean;
			hasMeaningfulContent: boolean;
			inlineError?: ChatInlineError;
	  }
	| {
			kind: "pending";
			user: LightfastAppChatUIMessage;
			inlineError?: ChatInlineError;
	  }
	| {
			kind: "ghost";
			user: LightfastAppChatUIMessage;
			assistant: LightfastAppChatUIMessage;
			reason: "no-reply" | "empty-response";
			inlineError?: ChatInlineError;
	  }
	| {
			kind: "system";
			assistant: LightfastAppChatUIMessage;
			isStreaming: boolean;
			hasMeaningfulContent: boolean;
			inlineError?: ChatInlineError;
	  };

const createGhostAssistantMessage = (
	userMessage: LightfastAppChatUIMessage,
	reason: "no-reply" | "empty-response",
): LightfastAppChatUIMessage => ({
	id: `ghost-${reason}-${userMessage.id}`,
	role: "assistant",
	parts: [
		{
			type: "text",
			text: "_No message content_",
		},
	],
});

const createPendingAssistantMessage = (
	userMessage: LightfastAppChatUIMessage,
): LightfastAppChatUIMessage => ({
	id: `pending-${userMessage.id}`,
	role: "assistant",
	parts: [],
});

const buildAssistantTurns = (
	messages: LightfastAppChatUIMessage[],
	status: ChatStatus,
	hasActiveStream: boolean,
	inlineErrors: ChatInlineError[] = [],
): AssistantTurn[] => {
	const baseTurns: AssistantTurn[] = [];
	let pendingUser: LightfastAppChatUIMessage | null = null;
	const hasStreamingStatus = status === "submitted" || status === "streaming";

	let lastAssistantId: string | null = null;
	for (let index = messages.length - 1; index >= 0; index--) {
		const candidate = messages[index];
		if (candidate?.role === "assistant") {
			lastAssistantId = candidate.id;
			break;
		}
	}

	const lastMessage = messages[messages.length - 1];
	const streamingAssistantId =
		(hasStreamingStatus || hasActiveStream) && lastMessage?.role === "assistant"
			? lastAssistantId
			: null;

	for (const message of messages) {
		if (message.role === "user") {
			if (pendingUser) {
				baseTurns.push({
					kind: "ghost",
					user: pendingUser,
					assistant: createGhostAssistantMessage(pendingUser, "no-reply"),
					reason: "no-reply",
				});
			}
			pendingUser = message;
			continue;
		}

		if (message.role === "assistant") {
			const isStreaming =
				streamingAssistantId === message.id &&
				(hasStreamingStatus || hasActiveStream);
			const meaningfulContent = hasMeaningfulContent(message);

			if (pendingUser) {
				if (!meaningfulContent && !isStreaming) {
					baseTurns.push({
						kind: "ghost",
						user: pendingUser,
						assistant: createGhostAssistantMessage(
							pendingUser,
							"empty-response",
						),
						reason: "empty-response",
					});
					pendingUser = null;
					continue;
				}

				baseTurns.push({
					kind: "answer",
					user: pendingUser,
					assistant: message,
					isStreaming,
					hasMeaningfulContent: meaningfulContent,
				});
				pendingUser = null;
				continue;
			}

			baseTurns.push({
				kind: "system",
				assistant: message,
				isStreaming,
				hasMeaningfulContent: meaningfulContent,
			});
			continue;
		}

		baseTurns.push({
			kind: "system",
			assistant: message,
			isStreaming: false,
			hasMeaningfulContent: hasMeaningfulContent(message),
		});
	}

	if (pendingUser) {
		if (hasStreamingStatus || hasActiveStream) {
			baseTurns.push({
				kind: "pending",
				user: pendingUser,
			});
		} else {
			baseTurns.push({
				kind: "ghost",
				user: pendingUser,
				assistant: createGhostAssistantMessage(pendingUser, "no-reply"),
				reason: "no-reply",
			});
		}
	}

	if (inlineErrors.length === 0) {
		return baseTurns;
	}

	const assistantErrorMap = new Map<string, ChatInlineError>();
	const userErrorMap = new Map<string, ChatInlineError>();
	const unattachedErrors: ChatInlineError[] = [];

	for (const inlineError of inlineErrors) {
		if (inlineError.relatedAssistantMessageId) {
			assistantErrorMap.set(inlineError.relatedAssistantMessageId, inlineError);
			continue;
		}
		if (inlineError.relatedUserMessageId) {
			userErrorMap.set(inlineError.relatedUserMessageId, inlineError);
			continue;
		}
		unattachedErrors.push(inlineError);
	}

	const pickAssistantError = (messageId?: string) => {
		if (!messageId) return undefined;
		const error = assistantErrorMap.get(messageId);
		if (error) {
			assistantErrorMap.delete(messageId);
		}
		return error;
	};

	const pickUserError = (messageId?: string) => {
		if (!messageId) return undefined;
		const error = userErrorMap.get(messageId);
		if (error) {
			userErrorMap.delete(messageId);
		}
		return error;
	};

	const enrichedTurns: AssistantTurn[] = baseTurns.map((turn) => {
		switch (turn.kind) {
			case "answer": {
				const inlineError =
					pickAssistantError(turn.assistant.id) ?? pickUserError(turn.user.id);
				return inlineError ? { ...turn, inlineError } : turn;
			}
			case "ghost": {
				const inlineError =
					pickAssistantError(turn.assistant.id) ?? pickUserError(turn.user.id);
				return inlineError ? { ...turn, inlineError } : turn;
			}
			case "pending": {
				const inlineError = pickUserError(turn.user.id);
				return inlineError ? { ...turn, inlineError } : turn;
			}
			case "system": {
				const inlineError = pickAssistantError(turn.assistant.id);
				return inlineError ? { ...turn, inlineError } : turn;
			}
			default:
				return turn;
		}
	});

	const remainingErrors = [
		...assistantErrorMap.values(),
		...userErrorMap.values(),
		...unattachedErrors,
	];

	if (remainingErrors.length === 0) {
		return enrichedTurns;
	}

	const looseTurns: AssistantTurn[] = remainingErrors.map((error) => ({
		kind: "system",
		assistant: {
			id: `inline-error-${error.id}`,
			role: "assistant",
			parts: [],
		},
		isStreaming: false,
		hasMeaningfulContent: false,
		inlineError: error,
	}));

	return [...enrichedTurns, ...looseTurns];
};

// User messages - simple text display only
const UserMessage = memo(function UserMessage({
	message,
}: {
	message: LightfastAppChatUIMessage;
}) {
	const textContent = message.parts
		.filter(isTextPart)
		.map((part) => part.text)
		.join("\n");

	return (
		<div className="py-1">
			<div className="mx-auto max-w-3xl px-4 lg:px-14 xl:px-20">
				<Message from="user" className="justify-end">
					<MessageContent variant="chat">
						<p className="whitespace-pre-wrap text-sm">{textContent}</p>
					</MessageContent>
				</Message>
			</div>
		</div>
	);
});

// Assistant messages - complex parts-based rendering
const AssistantMessage = memo(function AssistantMessage({
	message,
	onArtifactClick,
	status,
	isCurrentlyStreaming,
	feedback,
	onFeedbackSubmit,
	onFeedbackRemove,
	_isAuthenticated,
	hideActions = false,
	meaningfulContentOverride,
	inlineError,
	onInlineErrorDismiss,
}: {
	message: LightfastAppChatUIMessage;
	onArtifactClick?: (artifactId: string) => void;
	status: ChatStatus;
	isCurrentlyStreaming?: boolean;
	feedback?: Record<string, "upvote" | "downvote">;
	onFeedbackSubmit?: (
		messageId: string,
		feedbackType: "upvote" | "downvote",
	) => void;
	onFeedbackRemove?: (messageId: string) => void;
	_isAuthenticated: boolean;
	hideActions?: boolean;
	meaningfulContentOverride?: boolean;
	inlineError?: ChatInlineError;
	onInlineErrorDismiss?: (errorId: string) => void;
}) {
	const sources = useMemo<CitationSource[]>(() => {
		if (status !== "ready") {
			return [];
		}
		const textContent = message.parts
			.filter(isTextPart)
			.map((part) => part.text)
			.join("\n");
		return parseResponseMetadata(textContent).citations;
	}, [message.parts, status]);

	// Hook for copy functionality with success state
	const { copyToClipboard, isCopied } = useCopyToClipboard({
		showToast: true,
		toastMessage: "Message copied to clipboard!",
	});

	const handleCopyMessage = () => {
		const textContent = message.parts
			.filter(isTextPart)
			.map((part) => part.text)
			.join("\n");
		void copyToClipboard(textContent);
	};

	const handleFeedback = (feedbackType: "upvote" | "downvote") => {
		if (onFeedbackSubmit) {
			const currentFeedback = feedback?.[message.id];

			// If clicking the same feedback type, remove it (toggle off)
			if (currentFeedback === feedbackType) {
				onFeedbackRemove?.(message.id);
			} else {
				// Otherwise, submit the new feedback
				onFeedbackSubmit(message.id, feedbackType);
			}
		}
	};

	const currentFeedback = feedback?.[message.id];
	const meaningfulContent =
		meaningfulContentOverride ?? hasMeaningfulContent(message);
	const hasDisplayContent = meaningfulContent || Boolean(inlineError);
	const showStreamingWave = Boolean(isCurrentlyStreaming && !hasDisplayContent);
	const noMessageContent = message.parts.length === 0;
	const shouldHideActions =
		hideActions ||
		(Boolean(inlineError) &&
			(noMessageContent || inlineError?.severity === "fatal"));

	return (
		<div className="py-1">
			<div className="mx-auto max-w-3xl px-4 lg:px-14 xl:px-20">
				<Message
					from="assistant"
					className="flex-col items-start [&>div]:max-w-full"
				>
					<div className="relative w-full">
						<div
							className={cn(
								"absolute inset-0 flex items-start transition-opacity duration-150",
								showStreamingWave
									? "opacity-100"
									: "opacity-0 pointer-events-none",
							)}
						>
							<StreamingSineWave key="stable-sine-wave" show />
						</div>
						<div
							className={cn(
								"space-y-1 w-full transition-opacity duration-150",
								showStreamingWave ? "opacity-90" : "opacity-100",
							)}
						>
							{message.parts.map((part, index) => {
								if (isTextPart(part)) {
									const cleanedText = cleanTextFromMetadata(part.text);
									const shouldAnimate = Boolean(
										isCurrentlyStreaming && index === message.parts.length - 1,
									);
									return (
										<AssistantTextPart
											key={`${message.id}-text-${index}`}
											cleanedText={cleanedText}
											shouldAnimate={shouldAnimate}
										/>
									);
								}

								if (isReasoningPart(part) && part.text.length > 1) {
									const isReasoningStreaming = Boolean(
										isCurrentlyStreaming && index === message.parts.length - 1,
									);
									const trimmedText = part.text.replace(/^\n+/, "");
									return (
										<AssistantReasoningPart
											key={`${message.id}-reasoning-${index}`}
											reasoningText={trimmedText}
											isStreaming={isReasoningStreaming}
										/>
									);
								}

								// Tool part (e.g., "tool-webSearch", "tool-fileWrite")
								if (isToolPart(part)) {
									const toolName = part.type.replace("tool-", "");

									return (
										<div key={`${message.id}-part-${index}`} className="w-full">
											<ToolCallRenderer
												toolPart={part as ToolUIPart}
												toolName={toolName}
												onArtifactClick={onArtifactClick}
											/>
										</div>
									);
								}

								// Unknown part type
								return null;
							})}

							{inlineError && (
								<div className="mt-3">
									<InlineErrorCard
										inlineError={inlineError}
										onDismiss={onInlineErrorDismiss}
									/>
								</div>
							)}
						</div>
					</div>

					{/* Actions and Citations - hidden when streaming without content */}
					{!shouldHideActions && (
						<div
							className={cn(
								"w-full mt-2",
								!hasDisplayContent
									? "opacity-0 pointer-events-none"
									: "opacity-100",
							)}
						>
							<div className="flex items-center justify-between">
								{sources.length > 0 ? (
									<InlineCitationCard>
										<InlineCitationCardTrigger
											sources={sources.map((source) => source.url)}
										/>
										<InlineCitationCardBody>
											<InlineCitationCarousel>
												<InlineCitationCarouselHeader>
													<InlineCitationCarouselPrev />
													<InlineCitationCarouselIndex />
													<InlineCitationCarouselNext />
												</InlineCitationCarouselHeader>
												<InlineCitationCarouselContent>
													{sources.map((source, index) => (
														<InlineCitationCarouselItem key={index}>
															<InlineCitationSource
																title={source.title ?? `Source ${index + 1}`}
																url={source.url}
															/>
														</InlineCitationCarouselItem>
													))}
												</InlineCitationCarouselContent>
											</InlineCitationCarousel>
										</InlineCitationCardBody>
									</InlineCitationCard>
								) : (
									<div></div>
								)}
								{/* Actions - always present but hidden during streaming */}
								<Actions
									className={cn(
										"transition-opacity duration-200",
										isCurrentlyStreaming
											? "opacity-0 pointer-events-none"
											: "opacity-100",
									)}
								>
									<Action
										tooltip="Copy message"
										onClick={handleCopyMessage}
										className={isCopied ? "text-green-600" : ""}
									>
										{isCopied ? (
											<Check className="w-4 h-4" />
										) : (
											<Copy className="w-4 h-4" />
										)}
									</Action>

									{/* Feedback buttons - only show for authenticated users */}
									{_isAuthenticated && onFeedbackSubmit && (
										<>
											<Action
												tooltip="Helpful"
												onClick={() => handleFeedback("upvote")}
												className={
													currentFeedback === "upvote"
														? "text-blue-600 bg-accent/50"
														: ""
												}
											>
												<ThumbsUp />
											</Action>

											<Action
												tooltip="Not helpful"
												onClick={() => handleFeedback("downvote")}
												className={
													currentFeedback === "downvote"
														? "text-red-600 bg-accent/50"
														: ""
												}
											>
												<ThumbsDown />
											</Action>
										</>
									)}
								</Actions>
							</div>
						</div>
					)}
				</Message>
			</div>
		</div>
	);
});

export function ChatMessages({
	messages,
	status,
	onArtifactClick,
	feedback,
	onFeedbackSubmit,
	onFeedbackRemove,
	_isAuthenticated,
	isExistingSessionWithNoMessages = false,
	hasActiveStream = false,
	inlineErrors = [],
	onInlineErrorDismiss,
}: ChatMessagesProps) {
	const turns = useMemo(
		() => buildAssistantTurns(messages, status, hasActiveStream, inlineErrors),
		[messages, hasActiveStream, status, inlineErrors],
	);

	const streamingStatus = status === "submitted" || status === "streaming";

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<Conversation className="flex-1 scrollbar-thin" resize="smooth">
				<ConversationContent className=" flex flex-col p-0 last:pb-12">
					{/* Show empty state message for existing sessions with no messages */}
					{isExistingSessionWithNoMessages && (
						<div className="py-8">
							<div className="mx-auto max-w-3xl px-4 lg:px-14 xl:px-20">
								<div className="text-center text-muted-foreground">
									<p className="text-sm mb-2">
										This conversation has no messages yet.
									</p>
									<p className="text-xs">
										Start typing below to begin the conversation.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Render combined user/assistant turns */}
					{turns.map((turn) => {
						switch (turn.kind) {
							case "answer": {
								return (
									<Fragment key={`${turn.user.id}-${turn.assistant.id}`}>
										<UserMessage message={turn.user} />
										<AssistantMessage
											message={turn.assistant}
											onArtifactClick={onArtifactClick}
											status={status}
											isCurrentlyStreaming={turn.isStreaming && streamingStatus}
											feedback={feedback}
											onFeedbackSubmit={onFeedbackSubmit}
											onFeedbackRemove={onFeedbackRemove}
											_isAuthenticated={_isAuthenticated}
											meaningfulContentOverride={turn.hasMeaningfulContent}
											inlineError={turn.inlineError}
											onInlineErrorDismiss={onInlineErrorDismiss}
										/>
									</Fragment>
								);
							}
							case "pending": {
								const pendingAssistant = createPendingAssistantMessage(
									turn.user,
								);
								return (
									<Fragment key={`${turn.user.id}-pending`}>
										<UserMessage message={turn.user} />
										<AssistantMessage
											message={pendingAssistant}
											onArtifactClick={onArtifactClick}
											status={status}
											isCurrentlyStreaming={streamingStatus || hasActiveStream}
											feedback={feedback}
											onFeedbackSubmit={onFeedbackSubmit}
											onFeedbackRemove={onFeedbackRemove}
											_isAuthenticated={_isAuthenticated}
											hideActions
											meaningfulContentOverride={false}
											inlineError={turn.inlineError}
											onInlineErrorDismiss={onInlineErrorDismiss}
										/>
									</Fragment>
								);
							}
							case "ghost": {
								return (
									<Fragment key={`${turn.user.id}-${turn.assistant.id}-ghost`}>
										<UserMessage message={turn.user} />
										<AssistantMessage
											message={turn.assistant}
											onArtifactClick={onArtifactClick}
											status={status}
											isCurrentlyStreaming={false}
											feedback={feedback}
											onFeedbackSubmit={onFeedbackSubmit}
											onFeedbackRemove={onFeedbackRemove}
											_isAuthenticated={_isAuthenticated}
											hideActions
											meaningfulContentOverride={false}
											inlineError={turn.inlineError}
											onInlineErrorDismiss={onInlineErrorDismiss}
										/>
									</Fragment>
								);
							}
							case "system": {
								return (
									<AssistantMessage
										key={turn.assistant.id}
										message={turn.assistant}
										onArtifactClick={onArtifactClick}
										status={status}
										isCurrentlyStreaming={turn.isStreaming && streamingStatus}
										feedback={feedback}
										onFeedbackSubmit={onFeedbackSubmit}
										onFeedbackRemove={onFeedbackRemove}
										_isAuthenticated={_isAuthenticated}
										meaningfulContentOverride={turn.hasMeaningfulContent}
										inlineError={turn.inlineError}
										onInlineErrorDismiss={onInlineErrorDismiss}
									/>
								);
							}
							default:
								return null;
						}
					})}
				</ConversationContent>
				<ConversationScrollButton
					className="absolute bottom-4 z-20 right-4 rounded-full shadow-lg transition-all duration-200"
					variant="secondary"
					size="icon"
				/>
			</Conversation>
		</div>
	);
}
