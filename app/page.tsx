"use client";

import { useChat } from "@ai-sdk/react";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatTransport } from "@/hooks/use-chat-transport";

export default function Home() {
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const threadId = useRef(`thread-${Date.now()}`).current;

	// Create transport for AI SDK v5
	const transport = useChatTransport({ threadId });

	// Use the chat hook with transport
	const {
		messages = [],
		sendMessage: vercelSendMessage,
		status,
	} = useChat({
		id: threadId,
		transport,
		initialMessages: [],
		onError: (error) => {
			console.error("Chat error:", error);
		},
	});

	const [input, setInput] = useState("");
	const isLoading = status === "streaming" || status === "submitted";

	useEffect(() => {
		if (scrollAreaRef.current) {
			scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
		}
	}, [messages]);

	return (
		<main className="flex h-screen flex-col">
			<header className="border-b px-6 py-4">
				<h1 className="text-2xl font-bold">HAL9000 - Mastra AI Assistant</h1>
			</header>

			<ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
				<div className="mx-auto max-w-2xl space-y-4">
					{messages.length === 0 && (
						<div className="text-center text-muted-foreground py-8">
							<p className="text-lg">Welcome to HAL9000</p>
							<p className="text-sm mt-2">Start a conversation by typing a message below</p>
						</div>
					)}
					{messages.map((message) => {
						// Extract text content from parts
						const textContent =
							message.parts
								?.filter((part: any) => part.type === "text")
								.map((part: any) => part.text)
								.join("\n") ||
							message.content ||
							"";

						return (
							<div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
								<div
									className={`max-w-[80%] rounded-lg px-4 py-2 ${
										message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
									}`}
								>
									<p className="whitespace-pre-wrap">{textContent}</p>
								</div>
							</div>
						);
					})}
					{isLoading && (
						<div className="flex justify-start">
							<div className="bg-muted rounded-lg px-4 py-2">
								<div className="flex space-x-1">
									<div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
									<div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:100ms]" />
									<div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:200ms]" />
								</div>
							</div>
						</div>
					)}
				</div>
			</ScrollArea>

			<form
				onSubmit={async (e) => {
					e.preventDefault();
					if (!input.trim() || isLoading) return;

					try {
						// Generate IDs for the messages
						const userMessageId = `user-${Date.now()}`;
						const assistantMessageId = `assistant-${Date.now()}`;

						// Use vercelSendMessage with the correct AI SDK v5 format
						await vercelSendMessage(
							{
								role: "user",
								parts: [{ type: "text", text: input }],
								id: userMessageId,
							},
							{
								body: {
									id: assistantMessageId,
									userMessageId,
									threadClientId: threadId,
								},
							},
						);
						setInput("");
					} catch (error) {
						console.error("Error sending message:", error);
					}
				}}
				className="border-t p-4"
			>
				<div className="mx-auto max-w-2xl flex gap-4">
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Type your message..."
						disabled={isLoading}
						className="flex-1"
					/>
					<Button type="submit" disabled={isLoading || !input.trim()}>
						<Send className="h-4 w-4" />
					</Button>
				</div>
			</form>
		</main>
	);
}
