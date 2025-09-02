"use client";

import type { ChatStatus } from "ai";
import { memo } from "react";
import { cn } from "../../lib/utils";
import type { DevServerUIMessage } from "../../types/chat";
import { Bot, User } from "lucide-react";

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
							<div className="mx-auto max-w-3xl px-8">
								<div className="flex items-start gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
										<Bot className="h-4 w-4 text-primary" />
									</div>
									<div className="flex-1">
										<div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
											<ThinkingIndicator />
										</div>
									</div>
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
	const isUser = message.role === "user";
	
	// Extract text from parts
	const textContent = message.parts
		.filter(part => part.type === 'text')
		.map((part: any) => part.text)
		.join('');

	if (isUser) {
		return (
			<div className="py-3">
				<div className="flex items-start gap-3 justify-end">
					<div className="flex-1 flex justify-end">
						<div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
							<p className="whitespace-pre-wrap text-sm">{textContent}</p>
						</div>
					</div>
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
						<User className="h-4 w-4 text-primary-foreground" />
					</div>
				</div>
			</div>
		);
	}

	// Assistant message
	return (
		<div className={cn("py-3", isLast && "pb-8")}>
			<div className="flex items-start gap-3">
				<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
					<Bot className="h-4 w-4 text-primary" />
				</div>
				<div className="flex-1">
					<div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
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