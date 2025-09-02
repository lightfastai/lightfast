"use client";

import type { ChatStatus } from "ai";
import { memo } from "react";
import { cn } from "../../lib/utils";
import type { DevServerUIMessage } from "../../types/chat";

interface ChatMessagesProps {
	messages: DevServerUIMessage[];
	status: ChatStatus;
}

// Memoized thinking indicator
const ThinkingIndicator = memo(function ThinkingIndicator() {
	return (
		<div className="flex items-center space-x-2">
			<div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
			<div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
			<div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
		</div>
	);
});

export function ChatMessages({ messages, status }: ChatMessagesProps) {
	// Add a placeholder assistant message when submitted
	const showThinking = status === "submitted" && messages[messages.length - 1]?.role === "user";

	return (
		<div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
			<div className="flex-1 py-4">
				<div className="mx-auto max-w-3xl px-4 space-y-4">
					{messages.map((message, index) => (
						<MessageItem
							key={message.id}
							message={message}
							isLast={index === messages.length - 1}
							isStreaming={index === messages.length - 1 && status === "streaming"}
						/>
					))}
					
					{/* Show thinking indicator when waiting for response */}
					{showThinking && (
						<div className="py-3">
							<div className="mx-auto max-w-3xl px-4">
								<div className="w-full px-4">
									<ThinkingIndicator />
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function MessageItem({
	message,
	isLast,
	isStreaming,
}: {
	message: DevServerUIMessage;
	isLast?: boolean;
	isStreaming?: boolean;
}) {
	// Extract text from parts
	const textContent = message.parts
		.filter(part => part.type === 'text')
		.map((part) => 'text' in part ? part.text : '')
		.join('');

	// For user messages
	if (message.role === "user") {
		return (
			<div className="py-3">
				<div className="mx-auto max-w-3xl px-8">
					<div className="flex justify-end">
						<div className="border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30 max-w-[80%]">
							<p className="whitespace-pre-wrap text-sm">{textContent}</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// For assistant messages
	return (
		<div className={cn("py-3", isLast && "pb-8")}>
			<div className="mx-auto max-w-3xl px-4">
				<div className="flex-col items-start gap-4 [&>div]:max-w-full">
					<div className="w-full bg-transparent px-8 py-0">
						<p className="whitespace-pre-wrap text-sm">
							{textContent}
							{isStreaming && textContent && <span className="animate-pulse">▊</span>}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}