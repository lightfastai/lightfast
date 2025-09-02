"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo } from "react";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { ThinkingMessage } from "@repo/ui/components/chat";
import { cn } from "@repo/ui/lib/utils";
import type { ChatStatus } from "ai";
import type { DevServerUIMessage } from "../types/chat";

interface ChatInterfaceProps {
	agentId: string;
	agentName?: string;
}

// Simple ChatEmptyState component
function ChatEmptyState({
	prompt = "What can I do for you?",
}: {
	prompt?: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center">
			<p className="text-3xl font-medium font-semibold text-center">{prompt}</p>
		</div>
	);
}

// Simple ChatMessages component
function ChatMessages({
	messages,
	status,
}: {
	messages: DevServerUIMessage[];
	status: ChatStatus;
}) {
	return (
		<div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
			<div className="flex-1 py-4">
				<div className="mx-auto max-w-3xl px-4 space-y-4">
					{messages.map((message, index) => (
						<MessageItem
							key={message.id}
							message={message}
							isLast={index === messages.length - 1}
							isStreaming={
								index === messages.length - 1 && status === "streaming"
							}
						/>
					))}

					{/* Show thinking indicator when submitted */}
					{status === "submitted" &&
						messages[messages.length - 1]?.role === "user" && (
							<div className="py-3">
								<div className="mx-auto max-w-3xl px-4">
									<div className="w-full px-4">
										<ThinkingMessage />
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
		.filter((part) => part.type === "text")
		.map((part) => ("text" in part ? part.text : ""))
		.join("");

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
							{isStreaming && textContent && (
								<span className="animate-pulse">▊</span>
							)}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

export function ChatInterface({ agentId, agentName }: ChatInterfaceProps) {
	// Generate a stable session ID for this chat session
	const sessionId = useMemo(
		() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		[],
	);

	// Create transport for the chat
	const transport = useMemo(() => {
		return new DefaultChatTransport<DevServerUIMessage>({
			api: "/api/stream",
			headers: {
				"Content-Type": "application/json",
			},
			prepareSendMessagesRequest: ({ body, headers, messages, api }) => {
				return {
					api,
					headers,
					body: {
						agentId,
						sessionId,
						messages,
						...body,
					},
				};
			},
		});
	}, [agentId, sessionId]);

	const {
		messages,
		sendMessage: vercelSendMessage,
		error,
		status,
	} = useChat<DevServerUIMessage>({
		id: `${agentId}-${sessionId}`,
		transport,
		experimental_throttle: 45,
		messages: [],
		onError: (err) => {
			console.error("Chat error:", err);
		},
	});

	// Handle sending message - matching apps/chat pattern
	const handleSendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || status === "streaming") {
				return;
			}

			try {
				// Generate UUID for the user message
				const userMessageId = crypto.randomUUID();

				// Create the user message object in the UI format expected by useChat
				const userMessage: DevServerUIMessage = {
					role: "user",
					parts: [{ type: "text", text: message }],
					id: userMessageId,
				};

				// Send message using sendMessage from useChat
				await vercelSendMessage(userMessage, {
					body: {
						userMessageId,
					},
				});
			} catch (error) {
				console.error("Failed to send message:", error);
			}
		},
		[vercelSendMessage, status],
	);

	// For new chats (no messages yet), show centered layout
	if (messages.length === 0) {
		return (
			<div className="h-full flex flex-col items-center justify-center">
				<div className="w-full max-w-3xl px-4">
					<div className="px-4 mb-8">
						<ChatEmptyState
							prompt={`Welcome! Ask ${agentName || "the agent"} anything`}
						/>
					</div>
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Ask anything..."
						disabled={status === "streaming"}
					/>
				</div>
			</div>
		);
	}

	// Thread view or chat with existing messages
	return (
		<div className="flex flex-col h-full bg-background">
			<ChatMessages messages={messages} status={status} />
			<div className="relative">
				<div className="max-w-3xl mx-auto p-4">
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Continue the conversation..."
						disabled={status === "streaming"}
					/>
				</div>
			</div>
		</div>
	);
}

