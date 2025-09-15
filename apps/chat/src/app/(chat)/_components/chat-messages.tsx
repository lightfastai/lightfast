"use client";

import type { ChatStatus, ToolUIPart } from "ai";
import { memo, useState, useEffect } from "react";
import { ToolCallRenderer } from "~/components/tool-renderers/tool-call-renderer";
import { SineWaveDots } from "~/components/sine-wave-dots";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import type { CitationSource } from "@repo/ui/lib/citation-parser";
import { parseResponseMetadata } from "~/ai/prompts/parsers/metadata-parser";
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

// Inline helper to remove metadata sections from text
const cleanMetadataSections = (text: string): string => {
	// Check for new ---METADATA--- format
	const metadataDelimiter = "---METADATA---";
	const metadataIndex = text.indexOf(metadataDelimiter);
	if (metadataIndex !== -1) {
		return text.substring(0, metadataIndex).trim();
	}

	// Check for legacy ---CITATIONS--- format
	const citationDelimiter = "---CITATIONS---";
	const delimiterIndex = text.indexOf(citationDelimiter);
	if (delimiterIndex !== -1) {
		return text.substring(0, delimiterIndex).trim();
	}

	// Legacy: Check if text ends with "Cited" - O(1) operation
	if (text.endsWith("Cited")) {
		// Find where "Cited sources" starts and cut there
		const citedIndex = text.lastIndexOf("Cited sources");
		if (citedIndex !== -1) {
			return text.substring(0, citedIndex).trim();
		}
	}

	// Legacy: Also check for numbered citation format that might not end with "Cited"
	// Look for pattern that suggests citations at the end
	if (/\[\d+\]\s+https?:\/\/[^\n]*$/.exec(text)) {
		const citationMatch = /\n\[\d+\]\s+https?:\/\//.exec(text);
		if (citationMatch?.index !== undefined) {
			return text.substring(0, citationMatch.index).trim();
		}
	}

	return text;
};
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
import { cn } from "@repo/ui/lib/utils";

// Stable sine wave component that persists during streaming
const StreamingSineWave = memo(function StreamingSineWave({ 
	show 
}: { 
	show: boolean 
}) {
	if (!show) return null;
	
	return (
		<div className="w-full px-8">
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
}

// Helper to check if message has meaningful streaming content
const hasMeaningfulContent = (message: LightfastAppChatUIMessage): boolean => {
	return message.parts.some(part => {
		// Text parts with more than 1 character
		if (isTextPart(part) && part.text.trim().length > 1) return true;
		// Any tool parts
		if (isToolPart(part)) return true;
		// Reasoning parts with more than 1 character
		if (isReasoningPart(part) && part.text.trim().length > 1) return true;
		return false;
	});
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
			<div className="mx-auto max-w-3xl px-8">
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
}) {
	const [sources, setSources] = useState<CitationSource[]>([]);

	// Process metadata when streaming is complete
	useEffect(() => {
		if (status !== "ready") return; // Only process when full response is received

		const textContent = message.parts
			.filter(isTextPart)
			.map((part) => part.text)
			.join("\n");

		// Parse metadata using new extensible parser
		const parsedMetadata = parseResponseMetadata(textContent);
		setSources(parsedMetadata.citations);
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

	return (
		<div className="py-1">
			<div className="mx-auto max-w-3xl group/message px-4">
				<Message
					from="assistant"
					className="flex-col items-start [&>div]:max-w-full"
				>
					<div className="space-y-1 w-full">
						{/* Show sine wave only when streaming without meaningful content */}
						{isCurrentlyStreaming && (
							<StreamingSineWave 
								key="stable-sine-wave"
								show={!hasMeaningfulContent(message)} 
							/>
						)}
						{message.parts.map((part, index) => {
							// Text part
							if (isTextPart(part)) {
								return (
									<MessageContent
										key={`${message.id}-part-${index}`}
										variant="chat"
										className="w-full px-8 py-0 [&>*]:my-0"
									>
										<Markdown className="[&>*]:my-0">
											{cleanMetadataSections(part.text)}
										</Markdown>
									</MessageContent>
								);
							}

							// Reasoning part
							if (isReasoningPart(part) && part.text.length > 1) {
								// Determine if this reasoning part is currently streaming
								const isReasoningStreaming =
									isCurrentlyStreaming && index === message.parts.length - 1;
								// Remove leading newlines while preserving other whitespace
								const trimmedText = part.text.replace(/^\n+/, "");

								return (
									<div key={`${message.id}-part-${index}`} className="w-full">
										<Reasoning
											className="w-full"
											isStreaming={isReasoningStreaming}
										>
											<ReasoningTrigger />
											<ReasoningContent>{trimmedText}</ReasoningContent>
										</Reasoning>
									</div>
								);
							}

							// Tool part (e.g., "tool-webSearch", "tool-fileWrite")
							if (isToolPart(part)) {
								const toolName = part.type.replace("tool-", "");

								return (
									<div
										key={`${message.id}-part-${index}`}
										className="w-full px-4"
									>
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

					{/* Actions and Citations - hidden when streaming without content */}
					<div
						className={cn(
							"w-full px-8 mt-2",
							!hasMeaningfulContent(message)
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
}: ChatMessagesProps) {
	// Check if we need a thinking placeholder
	const needsPlaceholder = status === "submitted" && messages[messages.length - 1]?.role === "user";
	
	// Determine which message should show streaming behavior  
	const shouldShowStreaming = (status === "submitted" || status === "streaming");

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<Conversation className="flex-1 scrollbar-thin" resize="smooth">
				<ConversationContent className=" flex flex-col p-0 last:pb-12">
					{/* Render existing messages */}
					{messages.map((message, index) => {
						const isCurrentlyStreaming = shouldShowStreaming && 
							index === messages.length - 1 && 
							message.role === "assistant";

						return message.role === "user" ? (
							<UserMessage key={message.id} message={message} />
						) : (
							<AssistantMessage
								key={message.id}
								message={message}
								onArtifactClick={onArtifactClick}
								status={status}
								isCurrentlyStreaming={isCurrentlyStreaming}
								feedback={feedback}
								onFeedbackSubmit={onFeedbackSubmit}
								onFeedbackRemove={onFeedbackRemove}
								_isAuthenticated={_isAuthenticated}
							/>
						);
					})}
					
					{/* Conditionally render thinking placeholder */}
					{needsPlaceholder && (
						<AssistantMessage
							key="thinking-placeholder"
							message={{ id: "thinking-placeholder", role: "assistant", parts: [] }}
							onArtifactClick={onArtifactClick}
							status={status}
							isCurrentlyStreaming={shouldShowStreaming}
							feedback={feedback}
							onFeedbackSubmit={onFeedbackSubmit}
							onFeedbackRemove={onFeedbackRemove}
							_isAuthenticated={_isAuthenticated}
						/>
					)}
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
