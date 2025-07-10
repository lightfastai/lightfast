"use client";

import { Loader2, Send } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSubscriptionToken, runTaskExecutor } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

export function ChatInterface() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [eventSource, setEventSource] = useState<EventSource | null>(null);
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (scrollAreaRef.current) {
			scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
		}
	}, []);

	// Cleanup EventSource on unmount
	useEffect(() => {
		return () => {
			if (eventSource) {
				eventSource.close();
			}
		};
	}, [eventSource]);

	const handleSubmit = useCallback(async () => {
		if (!input.trim() || isLoading) return;

		const userMessage: Message = {
			id: nanoid(),
			role: "user",
			content: input.trim(),
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		try {
			// Run the task executor and get chatId
			const chatId = await runTaskExecutor(userMessage.content);

			// Get subscription info
			const subscriptionInfo = await fetchSubscriptionToken(chatId);

			// Create EventSource for SSE
			const source = new EventSource(subscriptionInfo.url);
			setEventSource(source);

			source.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					if (data.type === "messages") {
						const messageData = data.data;
						setMessages((prev) => {
							// Check if message already exists
							const exists = prev.some((msg) => msg.role === "assistant" && msg.content.includes(messageData.message));

							if (!exists) {
								return [
									...prev,
									{
										id: messageData.id,
										role: "assistant",
										content: messageData.message,
										timestamp: new Date(),
									},
								];
							}

							return prev;
						});
					} else if (data.type === "status") {
						if (data.data.status === "completed" || data.data.status === "error") {
							setIsLoading(false);
							source.close();
							setEventSource(null);
						}
					}
				} catch (error) {
					console.error("Error parsing SSE data:", error);
				}
			};

			source.onerror = (error) => {
				console.error("SSE error:", error);
				setIsLoading(false);
				source.close();
				setEventSource(null);
			};
		} catch (error) {
			console.error("Error:", error);
			setMessages((prev) => [
				...prev,
				{
					id: nanoid(),
					role: "assistant",
					content: "Sorry, I encountered an error processing your request.",
					timestamp: new Date(),
				},
			]);
			setIsLoading(false);
		}
	}, [input, isLoading]);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}
		},
		[handleSubmit],
	);

	return (
		<div className="flex flex-col h-screen max-w-4xl mx-auto">
			{/* Header */}
			<div className="border-b p-4">
				<h1 className="text-2xl font-bold">Task Executor Assistant</h1>
				<p className="text-sm text-muted-foreground">
					Describe any computational task and I'll analyze, plan, and execute it for you.
				</p>
			</div>

			{/* Messages Area */}
			<ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
				{messages.length === 0 ? (
					<div className="text-center text-muted-foreground mt-8">
						<p className="mb-4">Welcome! I can help you with various computational tasks:</p>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto text-sm">
							<Card
								className="p-3 cursor-pointer hover:bg-accent"
								onClick={() => setInput("Generate a random password with 16 characters")}
							>
								Generate a random password
							</Card>
							<Card
								className="p-3 cursor-pointer hover:bg-accent"
								onClick={() => setInput("Calculate prime numbers up to 100")}
							>
								Calculate prime numbers
							</Card>
							<Card
								className="p-3 cursor-pointer hover:bg-accent"
								onClick={() => setInput("Convert a CSV file to JSON format")}
							>
								Convert CSV to JSON
							</Card>
							<Card
								className="p-3 cursor-pointer hover:bg-accent"
								onClick={() => setInput("Analyze the sentiment of product reviews")}
							>
								Sentiment analysis
							</Card>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						{messages.map((message) => (
							<div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
								<div
									className={cn(
										"max-w-[80%] rounded-lg px-4 py-2",
										message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
									)}
								>
									<p className="whitespace-pre-wrap">{message.content}</p>
									<p className="text-xs opacity-70 mt-1">{message.timestamp.toLocaleTimeString()}</p>
								</div>
							</div>
						))}
					</div>
				)}
			</ScrollArea>

			{/* Input Area */}
			<div className="border-t p-4 space-y-2">
				<div className="flex gap-2">
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder="Describe a task you want me to execute..."
						className="min-h-[80px] resize-none"
						disabled={isLoading}
					/>
					<Button onClick={handleSubmit} disabled={isLoading || !input.trim()} size="lg">
						{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
					</Button>
				</div>
				{isLoading && (
					<p className="text-sm text-muted-foreground flex items-center gap-2">
						<Loader2 className="h-3 w-3 animate-spin" />
						Processing your request...
					</p>
				)}
			</div>
		</div>
	);
}
