"use client";

import type { ChatStatus, ToolUIPart } from "ai";
import { Fragment, memo, useMemo } from "react";
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
import { Markdown } from "@repo/ui/components/markdown";
import { Actions, Action } from "@repo/ui/components/ai-elements/actions";
import { Copy, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";
import { useTypewriterStream } from "~/hooks/use-typewriter-stream";
import { cn } from "@repo/ui/lib/utils";

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

const TYPEWRITER_SPEED_MS = 5;

const StreamingMarkdown = memo(function StreamingMarkdown({
	text,
	animate,
	className,
	speedMs = TYPEWRITER_SPEED_MS,
}: {
	text: string;
	animate: boolean;
	className?: string;
	speedMs?: number;
}) {
	const displayText = useTypewriterStream(text, animate, { speedMs });
	return <Markdown className={className}>{displayText}</Markdown>;
});

const AssistantTextPart = memo(function AssistantTextPart({
	cleanedText,
	shouldAnimate,
	speedMs,
}: {
	cleanedText: string;
	shouldAnimate: boolean;
	speedMs: number;
}) {
	return (
		<MessageContent variant="chat" className="w-full py-0 [&>*]:my-0">
			<StreamingMarkdown
				className="[&>*]:my-0"
				text={cleanedText}
				animate={shouldAnimate}
				speedMs={speedMs}
			/>
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

type AssistantTurn =
	| {
			kind: "answer";
			user: LightfastAppChatUIMessage;
			assistant: LightfastAppChatUIMessage;
			isStreaming: boolean;
			hasMeaningfulContent: boolean;
	  }
	| {
			kind: "pending";
			user: LightfastAppChatUIMessage;
	  }
	| {
			kind: "ghost";
			user: LightfastAppChatUIMessage;
			assistant: LightfastAppChatUIMessage;
			reason: "no-reply" | "empty-response";
	  }
	| {
			kind: "system";
			assistant: LightfastAppChatUIMessage;
			isStreaming: boolean;
			hasMeaningfulContent: boolean;
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
): AssistantTurn[] => {
	const turns: AssistantTurn[] = [];
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
				turns.push({
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
					turns.push({
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

				turns.push({
					kind: "answer",
					user: pendingUser,
					assistant: message,
					isStreaming,
					hasMeaningfulContent: meaningfulContent,
				});
				pendingUser = null;
				continue;
			}

			turns.push({
				kind: "system",
				assistant: message,
				isStreaming,
				hasMeaningfulContent: meaningfulContent,
			});
			continue;
		}

		// Preserve any non-user/assistant messages as system entries.
		turns.push({
			kind: "system",
			assistant: message,
			isStreaming: false,
			hasMeaningfulContent: hasMeaningfulContent(message),
		});
	}

	if (pendingUser) {
		if (hasStreamingStatus || hasActiveStream) {
			turns.push({
				kind: "pending",
				user: pendingUser,
			});
		} else {
			turns.push({
				kind: "ghost",
				user: pendingUser,
				assistant: createGhostAssistantMessage(pendingUser, "no-reply"),
				reason: "no-reply",
			});
		}
	}

	return turns;
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
			<div className="mx-auto max-w-3xl px-14">
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
	const showStreamingWave = Boolean(isCurrentlyStreaming && !meaningfulContent);

	return (
		<div className="py-1">
			<div className="mx-auto max-w-3xl px-14">
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
									const shouldAnimate =
										isCurrentlyStreaming && index === message.parts.length - 1;
								return (
									<AssistantTextPart
										key={`${message.id}-text-${index}`}
										cleanedText={cleanedText}
										shouldAnimate={shouldAnimate}
										speedMs={TYPEWRITER_SPEED_MS}
									/>
								);
							}

							if (isReasoningPart(part) && part.text.length > 1) {
								const isReasoningStreaming =
									isCurrentlyStreaming && index === message.parts.length - 1;
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
						</div>
					</div>

					{/* Actions and Citations - hidden when streaming without content */}
					{!hideActions && (
						<div
							className={cn(
								"w-full mt-2",
								!meaningfulContent
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
}: ChatMessagesProps) {
	const turns = useMemo(
		() => buildAssistantTurns(messages, status, hasActiveStream),
		[messages, hasActiveStream, status],
	);

	const streamingStatus = status === "submitted" || status === "streaming";

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<Conversation className="flex-1 scrollbar-thin" resize="smooth">
				<ConversationContent className=" flex flex-col p-0 last:pb-12">
					{/* Show empty state message for existing sessions with no messages */}
					{isExistingSessionWithNoMessages && (
						<div className="py-8">
							<div className="mx-auto max-w-3xl px-7">
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
											meaningfulContentOverride={false}
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
									/>
								);
							}
							default:
								return null;
						}
					})}
				</ConversationContent>
				<ConversationScrollButton
					className="absolute bottom-4 z-[1000] right-4 rounded-full shadow-lg transition-all duration-200"
					variant="secondary"
					size="icon"
				/>
			</Conversation>
		</div>
	);
}
