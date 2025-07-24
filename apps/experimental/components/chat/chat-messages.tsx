"use client";

import type { LightfastUIMessage } from "@lightfast/types";
import { isTextPart, isToolPart } from "@lightfast/types";
import type { ChatStatus, ToolUIPart } from "ai";
import { ArrowDown } from "lucide-react";
import { useRef } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Markdown } from "@/components/markdown";
import { ThinkingMessage } from "@/components/thinking-message";
import { ToolCallRenderer } from "@/components/tool-renderers/tool-call-renderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
	messages: LightfastUIMessage[];
	status: ChatStatus;
}

// Extended message type that includes runtime status
interface MessageWithRuntimeStatus extends LightfastUIMessage {
	runtimeStatus?: "thinking" | "streaming" | "done";
}

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
	if (initialMessageCount.current === null) {
		initialMessageCount.current = messages.length;
	}

	// Add runtime status to messages and inject thinking placeholder
	const messagesWithStatus: MessageWithRuntimeStatus[] = messages.map((msg, index) => {
		if (index === messages.length - 1) {
			if (msg.role === "assistant" && status === "streaming") {
				return { ...msg, runtimeStatus: "streaming" };
			}
		}
		if (msg.role === "assistant") {
			return { ...msg, runtimeStatus: "done" };
		}
		return msg;
	});

	// Add a placeholder assistant message when submitted
	if (status === "submitted" && messages[messages.length - 1]?.role === "user") {
		messagesWithStatus.push({
			id: "thinking-placeholder",
			role: "assistant",
			parts: [],
			runtimeStatus: "thinking",
		});
	}

	return (
		<div className="flex-1 relative min-h-0 overflow-hidden">
			<StickToBottom className="absolute inset-0 overflow-y-auto" resize="smooth" initial="instant" role="log">
				<StickToBottom.Content className="flex w-full flex-col">
					{messagesWithStatus.map((message, index) => {
						const isLast = index === messagesWithStatus.length - 1;
						const hasScrollAnchor =
							isLast && initialMessageCount.current !== null && messagesWithStatus.length > initialMessageCount.current;
						return <MessageItem key={message.id} message={message} hasScrollAnchor={hasScrollAnchor} />;
					})}
				</StickToBottom.Content>
				<ScrollButton />
			</StickToBottom>
		</div>
	);
}

function MessageItem({ message, hasScrollAnchor }: { message: MessageWithRuntimeStatus; hasScrollAnchor?: boolean }) {
	// For user messages
	if (message.role === "user") {
		const textContent =
			message.parts
				?.filter(isTextPart)
				.map((part) => part.text)
				.join("\n") || "";

		return (
			<div className={cn("pb-12", hasScrollAnchor && "min-h-[var(--spacing-scroll-anchor)]")}>
				<div className="mx-auto max-w-3xl px-4 flex justify-end">
					<div className="max-w-[80%] border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30">
						<p className="whitespace-pre-wrap">{textContent}</p>
					</div>
				</div>
			</div>
		);
	}

	// For assistant messages, render parts in order
	return (
		<div className={cn("pb-12", hasScrollAnchor && "min-h-[var(--spacing-scroll-anchor)]")}>
			<div className="mx-auto max-w-3xl px-4 space-y-4">
				{/* Show thinking animation at top of assistant message based on runtime status */}
				{message.runtimeStatus && <ThinkingMessage status={message.runtimeStatus} show={true} className="mb-2" />}
				{message.parts?.map((part, index) => {
					// Text part
					if (isTextPart(part)) {
						return (
							<div key={`${message.id}-part-${index}`} className="w-full">
								<Markdown>{part.text}</Markdown>
							</div>
						);
					}

					// Tool part (e.g., "tool-webSearch", "tool-fileWrite")
					if (isToolPart(part)) {
						const toolName = part.type.replace("tool-", "");

						return (
							<div key={`${message.id}-part-${index}`} className="w-full">
								<ToolCallRenderer toolPart={part as ToolUIPart} toolName={toolName} />
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
