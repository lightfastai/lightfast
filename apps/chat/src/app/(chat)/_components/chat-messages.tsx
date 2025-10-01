"use client";

import type { ChatStatus, ToolUIPart, FileUIPart } from "ai";
import { Fragment, memo, useMemo, useRef, useEffect, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { ToolCallRenderer } from "./tool-call-renderer";
import { SineWaveDots } from "~/components/sine-wave-dots";
import type {
	LightfastAppChatUIMessage,
	LightfastAppChatUIMessagePart,
} from "@repo/chat-ai-types";
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
} from "@repo/chat-ai-types";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@repo/ui/components/ai-elements/conversation";
import {
	Message,
	MessageContent,
} from "@repo/ui/components/ai-elements/message";
import { Actions, Action } from "@repo/ui/components/ai-elements/actions";
import {
	Copy,
	ThumbsUp,
	ThumbsDown,
	Check,
	AlertCircle,
	X,
	PaperclipIcon,
	ImageIcon,
} from "lucide-react";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";
import { useStream } from "~/hooks/use-stream";
import { cn } from "@repo/ui/lib/utils";
import type { ChatInlineError } from "@repo/chat-ai-types/errors";
import { ChatErrorType } from "@repo/chat-ai-types/errors";

const ResponsePlaceholder = () => (
	<div className="h-5 w-32 animate-pulse rounded bg-muted/40" />
);

const Response = dynamic(
	() =>
		import("@repo/ui/components/ai-elements/response").then(
			(mod) => mod.Response,
		),
	{
		loading: ResponsePlaceholder,
		ssr: false,
	},
);

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
	onStreamAnimationChange?: (hasActiveAnimation: boolean) => void;
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

const isFileUIPart = (
	part: LightfastAppChatUIMessagePart,
): part is FileUIPart => part.type === "file";

const MessageAttachmentPreview = memo(function MessageAttachmentPreview({
	attachments,
	align,
}: {
	attachments: FileUIPart[];
	align: "start" | "end";
}) {
	const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

	const handleImageError = useCallback((url: string) => {
		setFailedImages((prev) => new Set(prev).add(url));
	}, []);

	if (!attachments.length) {
		return null;
	}

	return (
		<div
			className={cn(
				"mt-2 flex flex-wrap gap-2",
				align === "end" ? "justify-end" : "justify-start",
			)}
		>
				{attachments.map((attachment, index) => {
					const mediaType = attachment.mediaType;
					const isImage =
						typeof mediaType === "string" && mediaType.startsWith("image/");
					const filenameLabel =
						typeof attachment.filename === "string" && attachment.filename.length > 0
							? attachment.filename
							: undefined;
					const urlLabel = (() => {
						if (typeof attachment.url !== "string" || attachment.url.length === 0) {
							return undefined;
						}

						const [base] = attachment.url.split("?");
						if (!base || base.length === 0) {
							return undefined;
						}

						const segment = base.split("/").pop();
						return segment && segment.length > 0 ? segment : undefined;
					})();
					const label = filenameLabel ?? urlLabel ?? `Attachment ${index + 1}`;
					const hasImageLoadError = failedImages.has(attachment.url);

				if (isImage) {
					return (
						<a
							key={`${attachment.url}-${index}`}
							href={attachment.url}
							target="_blank"
							rel="noopener noreferrer"
							className="group relative block overflow-hidden rounded-md border"
							title={label}
						>
							{hasImageLoadError ? (
								<div className="flex h-24 w-24 items-center justify-center bg-muted">
									<div className="flex flex-col items-center gap-1 text-center">
										<ImageIcon className="h-6 w-6 text-muted-foreground" />
										<span className="max-w-[80px] truncate text-2xs text-muted-foreground">
											{label}
										</span>
									</div>
								</div>
							) : (
								<img
									src={attachment.url}
									alt={label}
									className="h-24 w-24 object-cover transition-transform group-hover:scale-[1.02]"
									loading="lazy"
									onError={() => handleImageError(attachment.url)}
								/>
							)}
						</a>
					);
				}

				return (
					<a
						key={`${attachment.url}-${index}`}
						href={attachment.url}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
					>
						<PaperclipIcon className="h-4 w-4" />
						<span className="max-w-[160px] truncate" title={label}>
							{label}
						</span>
					</a>
				);
			})}
		</div>
	);
});

const StreamingResponse = memo(function StreamingResponse({
	text,
	animate,
	className,
	onAnimationChange,
}: {
	text: string;
	animate: boolean;
	className?: string;
	onAnimationChange?: (isAnimating: boolean) => void;
}) {
	const contentRef = useRef("");
	const { stream, addPart, isAnimating } = useStream();
	const lastReportedRef = useRef<boolean | null>(null);

	useEffect(() => {
		if (!text) {
			contentRef.current = text;
			return;
		}

		const shouldAccumulate = animate || isAnimating;
		if (!shouldAccumulate) {
			contentRef.current = text;
			return;
		}

		if (contentRef.current !== text) {
			const delta = text.slice(contentRef.current.length);
			if (delta) {
				addPart(delta);
			}
			contentRef.current = text;
		}
	}, [text, animate, isAnimating, addPart]);

    const shouldDisplayStream = animate || isAnimating;
    // NOTE:
    //  - We intentionally do NOT fall back to `text` while animating to avoid a
    //    brief flash of the full accumulated content before the typewriter effect starts.
    //  - This can create a very short empty state before the first frame paints.
    //    If you want to mask that gap visually, keep the sine wave visible until the
    //    first streamed character is rendered (e.g., expose `hasRenderedChar` from
    //    the streaming hook and use that instead of raw `isAnimating`).
    const displayText = shouldDisplayStream ? stream : text;

    // Report only the hook animation state upstream to avoid feedback loops.
    useEffect(() => {
        if (!onAnimationChange) return;
        if (lastReportedRef.current === isAnimating) return;
        lastReportedRef.current = isAnimating;
        onAnimationChange(isAnimating);
    }, [isAnimating, onAnimationChange]);

	useEffect(() => {
		return () => {
			if (!onAnimationChange) return;
			if (lastReportedRef.current) {
				onAnimationChange(false);
				lastReportedRef.current = false;
			}
		};
	}, [onAnimationChange]);

	return <Response className={className}>{displayText}</Response>;
});

const getRecordString = (record: unknown, key: string): string | undefined => {
	if (!record || typeof record !== "object") return undefined;
	const value = (record as Record<string, unknown>)[key];
	return typeof value === "string" ? value : undefined;
};

const AssistantTextPart = memo(function AssistantTextPart({
	messageId,
	cleanedText,
	shouldAnimate,
	onAnimationStateChange,
}: {
	messageId: string;
	cleanedText: string;
	shouldAnimate: boolean;
	onAnimationStateChange?: (messageId: string, isAnimating: boolean) => void;
}) {
	const handleAnimationChange = useCallback(
		(isAnimating: boolean) => {
			onAnimationStateChange?.(messageId, isAnimating);
		},
		[messageId, onAnimationStateChange],
	);

	useEffect(() => {
		return () => {
			onAnimationStateChange?.(messageId, false);
		};
	}, [messageId, onAnimationStateChange]);

	return (
		<MessageContent variant="chat" className="w-full py-0">
			<StreamingResponse
				text={cleanedText}
				animate={shouldAnimate}
				onAnimationChange={handleAnimationChange}
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
	const textParts = message.parts.filter(isTextPart);
	const textContent = textParts.map((part) => part.text).join("\n");
	const hasText = textContent.trim().length > 0;
	const fileParts = message.parts.filter(isFileUIPart);

	return (
		<div className="py-1">
			<div className="mx-auto max-w-3xl px-4 lg:px-14 xl:px-20">
				<Message from="user" className="justify-end">
					<MessageContent variant="chat">
						{hasText && (
							<p className="whitespace-pre-wrap text-sm">{textContent}</p>
						)}
						<MessageAttachmentPreview attachments={fileParts} align="end" />
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
	onStreamAnimationChange,
	isStreamAnimating = false,
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
	onStreamAnimationChange?: (messageId: string, isAnimating: boolean) => void;
	isStreamAnimating?: boolean;
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
	// NOTE: `hasDisplayContent` is based on message content, not what is currently
	// painted by the typewriter. During the first animation frames, the text part
	// may still be visually empty while `meaningfulContent` is already true. If you
	// prefer to keep the streaming sine wave visible until the first character is
	// actually rendered, consider driving this with a `hasRenderedChar` flag from
	// the streaming hook (instead of `meaningfulContent`).
	const hasDisplayContent = meaningfulContent || Boolean(inlineError);
	const animationStreaming = Boolean(isCurrentlyStreaming);
	const animationHook = Boolean(isStreamAnimating);
	const isAnimationActive = animationStreaming || animationHook;
	const showStreamingWave = isAnimationActive && !hasDisplayContent;
	const noMessageContent = message.parts.length === 0;
	const inlineErrorSeverity = inlineError ? inlineError.severity : undefined;
	const shouldHideActions =
		hideActions ||
		(!!inlineError && (noMessageContent || inlineErrorSeverity === "fatal"));
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
										isAnimationActive && index === message.parts.length - 1,
									);
									return (
										<AssistantTextPart
											key={`${message.id}-text-${index}`}
											messageId={message.id}
											cleanedText={cleanedText}
											shouldAnimate={shouldAnimate}
											onAnimationStateChange={onStreamAnimationChange}
										/>
									);
								}

								if (isReasoningPart(part) && part.text.length > 1) {
									const isReasoningStreaming = Boolean(
										isAnimationActive && index === message.parts.length - 1,
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

								if (isFileUIPart(part)) {
									return (
										<MessageAttachmentPreview
											key={`${message.id}-file-${index}`}
											attachments={[part]}
											align="start"
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

					{/* Actions and Citations - always reserve space to avoid layout shift */}
					<div
						className={cn(
							"w-full mt-2",
							!hasDisplayContent
								? "opacity-0 pointer-events-none"
								: "opacity-100",
						)}
					>
						<div className="flex items-center justify-between min-h-[2rem]">
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
								<div />
							)}

							{/* Right side: Actions or reserved space */}
							{shouldHideActions ? (
								// Reserve the actions row height even when actions are hidden
								<div className="h-8" />
							) : (
								<Actions
									className={cn(
										"transition-opacity duration-200",
										isAnimationActive
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
							)}
						</div>
					</div>
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
	onStreamAnimationChange,
}: ChatMessagesProps) {
	const [animatingMessageIds, setAnimatingMessageIds] = useState<Set<string>>(
		() => new Set(),
	);
	const animatingMessagesRef = useRef(animatingMessageIds);

	useEffect(() => {
		animatingMessagesRef.current = animatingMessageIds;
	}, [animatingMessageIds]);

	const reportAnimationChange = useCallback(
		(messageId: string, isAnimating: boolean) => {
			setAnimatingMessageIds((current) => {
				const hasEntry = current.has(messageId);
				if (hasEntry === isAnimating) {
					return current;
				}
				const next = new Set(current);
				if (isAnimating) {
					next.add(messageId);
				} else {
					next.delete(messageId);
				}
				if (onStreamAnimationChange) {
					onStreamAnimationChange(next.size > 0);
				}
				return next;
			});
		},
		[onStreamAnimationChange],
	);

	useEffect(() => {
		return () => {
			if (animatingMessagesRef.current.size > 0) {
				if (onStreamAnimationChange) {
					onStreamAnimationChange(false);
				}
			}
		};
	}, [onStreamAnimationChange]);

	const turns = useMemo(
		() => buildAssistantTurns(messages, status, hasActiveStream, inlineErrors),
		[messages, hasActiveStream, status, inlineErrors],
	);

	const streamingStatus = status === "submitted" || status === "streaming";
	const shouldShowScrollButton = messages.length > 0;


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
								const assistantAnimating = animatingMessageIds.has(
									turn.assistant.id,
								);
								return (
									<Fragment key={turn.user.id}>
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
											isStreamAnimating={assistantAnimating}
											onStreamAnimationChange={reportAnimationChange}
										/>
									</Fragment>
								);
							}
							case "pending": {
								const pendingAssistant = createPendingAssistantMessage(
									turn.user,
								);
								const assistantAnimating = animatingMessageIds.has(
									pendingAssistant.id,
								);
								return (
									<Fragment key={turn.user.id}>
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
											isStreamAnimating={assistantAnimating}
											onStreamAnimationChange={reportAnimationChange}
										/>
									</Fragment>
								);
							}
							case "ghost": {
								const assistantAnimating = animatingMessageIds.has(
									turn.assistant.id,
								);
								return (
									<Fragment key={turn.user.id}>
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
										isStreamAnimating={assistantAnimating}
										onStreamAnimationChange={reportAnimationChange}
									/>
									</Fragment>
								);
							}
							case "system": {
								const assistantAnimating = animatingMessageIds.has(
									turn.assistant.id,
								);
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
										isStreamAnimating={assistantAnimating}
										onStreamAnimationChange={reportAnimationChange}
									/>
								);
							}
							default:
								return null;
						}
					})}
				</ConversationContent>
				{shouldShowScrollButton && (
					<ConversationScrollButton
						className="absolute bottom-4 z-20 right-4 rounded-full shadow-lg transition-all duration-200"
						variant="secondary"
						size="icon"
					/>
				)}
			</Conversation>
		</div>
	);
}
