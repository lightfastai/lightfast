"use client";

import { useChat } from "@lightfast/ai/v2/react";
import type { UIMessage } from "ai";
import { Bot, Loader2, Send, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatInputSectionProps {
	agentId: string;
	threadId: string;
	initialMessages?: UIMessage[];
}

export function ChatInputSection({ agentId, threadId, initialMessages = [] }: ChatInputSectionProps) {
	const router = useRouter();
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
	const [currentResponse, setCurrentResponse] = useState("");
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Update messages when initialMessages changes
	useEffect(() => {
		setMessages(initialMessages);
	}, [initialMessages]);

	// Use v2 chat hook for streaming
	const { status, response, sendMessage, reset } = useChat({
		sessionId: threadId,
		apiEndpoint: "/api/v2/stream/init",
		streamEndpoint: "/api/v2/stream",
		onChunk: (chunk) => {
			setCurrentResponse((prev) => prev + chunk);
		},
		onComplete: (fullResponse) => {
			// Add the assistant message to messages array
			const assistantMessage: UIMessage = {
				id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
				role: "assistant",
				parts: [{ type: "text", text: fullResponse }],
			};
			setMessages((prev) => [...prev, assistantMessage]);
			setCurrentResponse("");
		},
		onError: (error) => {
			console.error("Stream error:", error);
		},
	});

	// Auto-scroll to bottom
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, currentResponse]);

	const handleSendMessage = async (message: string) => {
		if (!message.trim() || status === "loading" || status === "streaming") return;

		// Update URL to include threadId
		if (window.location.pathname === `/v2-chat/${agentId}`) {
			router.replace(`/v2-chat/${agentId}/${threadId}`);
		}

		// Add user message to messages array
		const userMessage: UIMessage = {
			id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
			role: "user",
			parts: [{ type: "text", text: message }],
		};
		setMessages((prev) => [...prev, userMessage]);

		// Send message for streaming
		await sendMessage(message);
		setInput("");
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage(input);
		}
	};

	// Empty state
	if (messages.length === 0 && !currentResponse) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="w-full max-w-3xl px-4">
					<div className="text-center mb-8">
						<Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<h1 className="text-2xl font-semibold mb-2">Start a conversation</h1>
						<p className="text-muted-foreground">Ask me anything using the v2 streaming system</p>
					</div>
					<div className="flex gap-2">
						<Input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder="Type a message..."
							disabled={status === "loading" || status === "streaming"}
							className="flex-1"
						/>
						<Button
							onClick={() => handleSendMessage(input)}
							disabled={!input.trim() || status === "loading" || status === "streaming"}
							size="icon"
						>
							{status === "loading" || status === "streaming" ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// Chat with messages
	return (
		<>
			{/* Messages Area */}
			<ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
				<div className="max-w-3xl mx-auto space-y-4">
					{messages.map((message) => (
						<MessageBubble key={message.id} message={message} />
					))}

					{/* Current streaming response */}
					{currentResponse && (
						<div className="flex gap-3">
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
								<Bot className="h-5 w-5 text-primary" />
							</div>
							<div className="flex-1 space-y-2">
								<div className="bg-muted rounded-lg px-4 py-2">
									<p className="text-sm whitespace-pre-wrap">
										{currentResponse}
										<span className="animate-pulse">▋</span>
									</p>
								</div>
							</div>
						</div>
					)}

					<div ref={messagesEndRef} />
				</div>
			</ScrollArea>

			{/* Input Area */}
			<div className="border-t p-4">
				<div className="max-w-3xl mx-auto flex gap-2">
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Type a message..."
						disabled={status === "loading" || status === "streaming"}
						className="flex-1"
					/>
					<Button
						onClick={() => handleSendMessage(input)}
						disabled={!input.trim() || status === "loading" || status === "streaming"}
						size="icon"
					>
						{status === "loading" || status === "streaming" ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Send className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>
		</>
	);
}

function MessageBubble({ message }: { message: UIMessage }) {
	const isUser = message.role === "user";
	const text = message.parts.find((part) => part.type === "text")?.text || "";

	return (
		<div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
			<div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
				{isUser ? <User className="h-5 w-5 text-primary" /> : <Bot className="h-5 w-5 text-primary" />}
			</div>
			<div className={cn("flex-1 space-y-2", isUser && "flex justify-end")}>
				<div
					className={cn(
						"rounded-lg px-4 py-2 max-w-[80%]",
						isUser ? "bg-primary text-primary-foreground ml-auto" : "bg-muted",
					)}
				>
					<p className="text-sm whitespace-pre-wrap">{text}</p>
				</div>
			</div>
		</div>
	);
}
