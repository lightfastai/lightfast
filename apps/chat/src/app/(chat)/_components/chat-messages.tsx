"use client";

import type { ChatStatus, ToolUIPart } from "ai";
import { memo, useMemo } from "react";
import { ThinkingMessage } from "@repo/ui/components/chat";
import { ToolCallRenderer } from "~/components/tool-renderers/tool-call-renderer";
import { cn } from "@repo/ui/lib/utils";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
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
import { Message, MessageContent } from "@repo/ui/components/ai-elements/message";
import { Response } from "@repo/ui/components/ai-elements/response";

interface ChatMessagesProps {
	messages: LightfastAppChatUIMessage[];
	status: ChatStatus;
}

// Extended message type that includes runtime status
interface MessageWithRuntimeStatus extends LightfastAppChatUIMessage {
	runtimeStatus?: "thinking" | "streaming" | "reasoning" | "done";
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

export function ChatMessages({ messages, status }: ChatMessagesProps) {
	// Add runtime status to messages and inject thinking placeholder
	const messagesWithStatus: MessageWithRuntimeStatus[] = messages.map(
		(msg, index) => {
			if (index === messages.length - 1) {
				if (msg.role === "assistant" && status === "streaming") {
					return { ...msg, runtimeStatus: "streaming" };
				}
			}
			if (msg.role === "assistant") {
				return { ...msg, runtimeStatus: "done" };
			}
			return msg;
		},
	);

	// Add a placeholder assistant message when submitted
	if (
		status === "submitted" &&
		messages[messages.length - 1]?.role === "user"
	) {
		messagesWithStatus.push({
			id: "thinking-placeholder",
			role: "assistant",
			parts: [],
			runtimeStatus: "thinking",
		});
	}

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<Conversation className="flex-1 scrollbar-thin" resize="smooth">
				<ConversationContent className=" flex flex-col p-0">
					{/* Messages container with proper padding */}
					<div className="flex-1 py-4">
						{messagesWithStatus.map((message, index) => {
							const isLast = index === messagesWithStatus.length - 1;
							return (
								<MessageItem
									key={message.id}
									message={message}
									isLast={isLast}
								/>
							);
						})}
					</div>
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

function MessageItem({
	message,
	isLast,
}: {
	message: MessageWithRuntimeStatus;
	isLast?: boolean;
}) {
	// Determine if the latest part during streaming is a reasoning part
	const hasActiveReasoningPart = useMemo(() => {
		if (message.runtimeStatus !== "streaming" || message.parts.length === 0) {
			return false;
		}
		// Check if the last part is a reasoning part
		const lastPart = message.parts[message.parts.length - 1];
		return lastPart ? isReasoningPart(lastPart) : false;
	}, [message.parts, message.runtimeStatus]);

	// For user messages
	if (message.role === "user") {
		const textContent = message.parts
			.filter(isTextPart)
			.map((part) => part.text)
			.join("\n");

		return (
			<div className="py-3">
				<div className="mx-auto max-w-3xl px-8">
					<Message from="user" className="justify-end">
						<MessageContent className="border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30 group-[.is-user]:bg-transparent group-[.is-user]:text-foreground">
							<p className="whitespace-pre-wrap text-sm">{textContent}</p>
						</MessageContent>
					</Message>
				</div>
			</div>
		);
	}

	// For assistant messages, render parts in order

	return (
		<div className={cn("py-3", isLast && "pb-8")}>
			<div className="mx-auto max-w-3xl px-4">
				<Message
					from="assistant"
					className="flex-col items-start gap-4 [&>div]:max-w-full"
				>
					{/* Show thinking animation at top of assistant message based on runtime status */}
					{message.runtimeStatus && (
						<div className="w-full px-4">
							<ThinkingMessage
								status={
									hasActiveReasoningPart ? "reasoning" : message.runtimeStatus
								}
								show={true}
							/>
						</div>
					)}
					{message.parts.map((part, index) => {
						// Text part
						if (isTextPart(part)) {
							return (
								<MessageContent
									key={`${message.id}-part-${index}`}
									className="w-full bg-transparent group-[.is-assistant]:bg-transparent px-8 py-0"
								>
									<Response>{part.text}</Response>
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
									className="w-full px-8"
								>
									<ToolCallRenderer
										toolPart={part as ToolUIPart}
										toolName={toolName}
									/>
								</div>
							);
						}

						// Unknown part type
						return null;
					})}
				</Message>
			</div>
		</div>
	);
}
