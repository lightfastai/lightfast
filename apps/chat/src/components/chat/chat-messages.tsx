"use client";

import type { ChatStatus, ToolUIPart } from "ai";
import { ArrowDown } from "lucide-react";
import { memo, useMemo, useRef } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Markdown } from "@repo/ui/components/markdown";
import { ThinkingMessage } from "@repo/ui/components/chat";
import { ToolCallRenderer } from "~/components/tool-renderers/tool-call-renderer";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import {
	isReasoningPart,
	isTextPart,
	isToolPart,
} from "~/ai/lightfast-app-chat-ui-messages";

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

function ScrollButton() {
	const { isAtBottom, scrollToBottom } = useStickToBottomContext();

	return (
		<Button
			onClick={() => scrollToBottom()}
			className={cn(
				"absolute bottom-4 right-4 rounded-full p-2 shadow-lg transition-all duration-200",
				isAtBottom ? "opacity-0 pointer-events-none" : "opacity-100",
			)}
			variant="secondary"
			size="icon"
		>
			<ArrowDown className="h-4 w-4" />
		</Button>
	);
}

export function ChatMessages({ messages, status }: ChatMessagesProps) {
	// Track initial message count for scroll anchor
	const initialMessageCount = useRef<number | null>(null);
	initialMessageCount.current ??= messages.length;

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
			<StickToBottom
				className="flex-1 overflow-y-auto scrollbar-thin"
				resize="smooth"
				initial="instant"
				role="log"
			>
				<StickToBottom.Content className="min-h-full flex flex-col">
					{/* Messages container with proper padding */}
					<div className="flex-1 py-4">
						{messagesWithStatus.map((message, index) => {
							const isLast = index === messagesWithStatus.length - 1;
							const hasScrollAnchor =
								isLast &&
								initialMessageCount.current !== null &&
								messagesWithStatus.length > initialMessageCount.current;
							return (
								<MessageItem
									key={message.id}
									message={message}
									hasScrollAnchor={hasScrollAnchor}
									isLast={isLast}
								/>
							);
						})}
					</div>
				</StickToBottom.Content>
				<ScrollButton />
			</StickToBottom>
		</div>
	);
}

function MessageItem({
	message,
	hasScrollAnchor,
	isLast,
}: {
	message: MessageWithRuntimeStatus;
	hasScrollAnchor?: boolean;
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
			<div className={cn("py-3", hasScrollAnchor && "min-h-[100px]")}>
				<div className="mx-auto max-w-3xl px-8 flex justify-end">
					<div className="max-w-[80%] border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30">
						<p className="whitespace-pre-wrap">{textContent}</p>
					</div>
				</div>
			</div>
		);
	}

	// For assistant messages, render parts in order

	return (
		<div
			className={cn(
				"py-3",
				hasScrollAnchor && "min-h-[100px]",
				isLast && "pb-8",
			)}
		>
			<div className="mx-auto max-w-3xl px-4 space-y-4">
				{/* Show thinking animation at top of assistant message based on runtime status */}
				{message.runtimeStatus && (
					<div className="px-4">
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
							<div key={`${message.id}-part-${index}`} className="w-full px-8">
								<Markdown>{part.text}</Markdown>
							</div>
						);
					}

					// Reasoning part
					if (isReasoningPart(part) && part.text.length > 1) {
						return (
							<div key={`${message.id}-part-${index}`} className="w-full px-8">
								<ReasoningBlock text={part.text} />
							</div>
						);
					}

					// Tool part (e.g., "tool-webSearch", "tool-fileWrite")
					if (isToolPart(part)) {
						const toolName = part.type.replace("tool-", "");

						return (
							<div key={`${message.id}-part-${index}`} className="w-full px-8">
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
			</div>
		</div>
	);
}
