"use client";

import type { ChatStatus, ToolUIPart } from "ai";
import { memo, useState, useEffect } from "react";
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
	// Remove everything from "Cited sources" to the end
	const citedSourcesRegex = /(?:^|\n)Cited sources[\s\S]*$/im;
	return text.replace(citedSourcesRegex, "").trim();
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
import { Copy } from "lucide-react";

interface ChatMessagesProps {
	messages: LightfastAppChatUIMessage[];
	status: ChatStatus;
	onArtifactClick?: (artifactId: string) => void;
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
	isStreaming,
}: {
	message: LightfastAppChatUIMessage;
	onArtifactClick?: (artifactId: string) => void;
	isStreaming?: boolean;
}) {
	const [sources, setSources] = useState<string[]>([]);

	// Process citations when streaming is complete
	useEffect(() => {
		if (isStreaming) return; // Don't process during streaming

		const textContent = message.parts
			.filter(isTextPart)
			.map((part) => part.text)
			.join("\n");

		// Parse numbered citations and extract URLs from citation list
		const parsedCitations = parseCitations(textContent);
		setSources(parsedCitations.sources);
	}, [message.parts, isStreaming]);

	const handleCopyMessage = () => {
		const textContent = message.parts
			.filter(isTextPart)
			.map((part) => part.text)
			.join("\n");
		navigator.clipboard.writeText(textContent);
	};

	return (
		<div className="py-1 last:pb-8 ">
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
							<Actions className="">
								<Action tooltip="Copy message" onClick={handleCopyMessage}>
									<Copy />
								</Action>
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
}: ChatMessagesProps) {
	return (
		<div className="flex-1 flex flex-col min-h-0">
			<Conversation className="flex-1 scrollbar-thin" resize="smooth">
				<ConversationContent className=" flex flex-col p-0">
					{/* Messages container with proper padding */}
					{messages.map((message) =>
						message.role === "user" ? (
							<UserMessage key={message.id} message={message} />
						) : (
							<AssistantMessage
								key={message.id}
								message={message}
								onArtifactClick={onArtifactClick}
								isStreaming={status === "submitted"}
							/>
						),
					)}
					{/* Show sine wave dots when submitted */}
					{status === "submitted" && (
						<div className="py-1 px-4">
							<div className="mx-auto max-w-3xl px-8">
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
