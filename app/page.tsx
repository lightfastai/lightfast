"use client";

import { useChat } from "ai/react";
import { Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Home() {
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const threadId = useRef(`thread-${Date.now()}`);
	const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
		api: `/api/chat/thread/${threadId.current}`,
		body: {
			stream: true,
		},
	});

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
					{messages.map((message) => (
						<div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
							<div
								className={`max-w-[80%] rounded-lg px-4 py-2 ${
									message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
								}`}
							>
								<p className="whitespace-pre-wrap">{message.content}</p>
							</div>
						</div>
					))}
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

			<form onSubmit={handleSubmit} className="border-t p-4">
				<div className="mx-auto max-w-2xl flex gap-4">
					<Input
						value={input}
						onChange={handleInputChange}
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
