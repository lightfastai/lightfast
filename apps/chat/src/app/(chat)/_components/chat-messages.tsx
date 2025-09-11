"use client";

import type { ChatStatus, ToolUIPart } from "ai";
import { memo, useState, useEffect, useMemo } from "react";
import { ToolCallRenderer } from "~/components/tool-renderers/tool-call-renderer";
import { SineWaveDots } from "~/components/sine-wave-dots";
import { cn } from "@repo/ui/lib/utils";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import {
	parseCitations,
	generateSourceTitle,
} from "@repo/ui/lib/citation-parser";
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

// Inline helper to remove cited sources section from text  
const cleanCitedSources = (text: string): string => {
	// Check if text ends with "Cited" - O(1) operation
	if (text.endsWith("Cited")) {
		// Find where "Cited sources" starts and cut there
		const citedIndex = text.lastIndexOf("Cited sources");
		if (citedIndex !== -1) {
			return text.substring(0, citedIndex).trim();
		}
	}
	
	// Also check for numbered citation format that might not end with "Cited"
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
import { Response } from "@repo/ui/components/ai-elements/response";
import { Actions, Action } from "@repo/ui/components/ai-elements/actions";
import { Copy, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";

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
}

// Memoized reasoning block component
const ReasoningBlock = memo(function ReasoningBlock({
	text,
}: {
	text: string;
}) {
	// Remove leading newlines while preserving other whitespace
	const trimmedText = text.replace(/^\n+/, "");

	return (
		<div className="border border-muted rounded-lg max-h-[200px] overflow-hidden">
			<div className="max-h-[200px] overflow-y-auto scrollbar-thin">
				<div className="p-4">
					<p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words">
						{trimmedText}
					</p>
				</div>
			</div>
		</div>
	);
});

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
}) {
	const [sources, setSources] = useState<string[]>([]);

	// Process citations when streaming is complete
	useEffect(() => {
		if (status !== "ready") return; // Only process when full response is received

		const textContent = message.parts
			.filter(isTextPart)
			.map((part) => part.text)
			.join("\n");

		// Parse numbered citations and extract URLs from citation list
		const parsedCitations = parseCitations(textContent);
		setSources(parsedCitations.sources);
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
					<div className="space-y-1">
						{message.parts.map((part, index) => {
							// Text part
							if (isTextPart(part)) {
								return (
									<MessageContent
										key={`${message.id}-part-${index}`}
										variant="chat"
										className="w-full px-8 py-0 [&>*]:my-0"
									>
										<Response className="[&>*]:my-0">
											{cleanCitedSources(part.text)}
										</Response>
									</MessageContent>
								);
							}

							// Reasoning part
							if (isReasoningPart(part) && part.text.length > 1) {
								return (
									<div
										key={`${message.id}-part-${index}`}
										className="w-full px-8"
									>
										<ReasoningBlock text={part.text} />
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

					{/* Actions and Citations */}
					<div className="w-full px-8 mt-2">
						<div className="flex items-center justify-between">
							{sources.length > 0 ? (
								<InlineCitationCard>
									<InlineCitationCardTrigger sources={sources} />
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
															title={generateSourceTitle(source)}
															url={source}
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
							{/* Show actions for all messages except currently streaming one */}
							{!isCurrentlyStreaming && (
								<Actions className="">
									<Action 
										tooltip="Copy message" 
										onClick={handleCopyMessage}
										className={isCopied ? "text-green-600" : ""}
									>
										{isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
									</Action>

									{/* Feedback buttons */}
									{onFeedbackSubmit && (
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
}: ChatMessagesProps) {
	// Memoize the streaming message index calculation - O(n) once per render instead of O(n²)
	const streamingMessageIndex = useMemo(() => {
		// No streaming during submitted/ready states
		if (status === "ready" || status === "submitted") return -1;
		
		// Find last assistant message index efficiently
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "assistant") {
				return i;
			}
		}
		return -1;
	}, [messages, status]);

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<Conversation className="flex-1 scrollbar-thin" resize="smooth">
				<ConversationContent className=" flex flex-col p-0 last:pb-12">
					{/* Messages container with proper padding */}
					{messages.map((message, index) => {
						const isCurrentlyStreaming = index === streamingMessageIndex;
						
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
							/>
						);
					})}
					{/* Show sine wave dots when submitted */}
					{status === "submitted" && (
						<div className="py-1 px-4">
							<div className="mx-auto max-w-3xl px-4">
								<SineWaveDots />
							</div>
						</div>
					)}
				</ConversationContent>
				<ConversationScrollButton
					className="absolute bottom-4 right-4 rounded-full shadow-lg transition-all duration-200"
					variant="secondary"
					size="icon"
				/>
			</Conversation>
		</div>
	);
}
