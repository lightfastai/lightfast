"use client";

import { useChat } from "@lightfast/ai/v2/react";
import { AlertCircle, Bot, Loader2, Send, User, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TestInstantStreamPage() {
	const { messages, input, setInput, sendMessage, isStreaming, connectionStatus, currentThinking, sessionId, error } =
		useChat({
			url: "/api/v2",
			tools: ["calculator", "weather"],
			temperature: 0.7,
		});

	const scrollAreaRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollAreaRef.current) {
			scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
		}
	}, [messages, currentThinking]);

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	return (
		<div className="container mx-auto p-4 max-w-4xl h-screen flex flex-col">
			<Card className="flex-1 flex flex-col">
				{/* Header */}
				<div className="border-b p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Bot className="h-6 w-6" />
							<h1 className="text-xl font-semibold">Instant Stream Chat</h1>
							<Badge variant="secondary" className="text-xs">
								<Zap className="h-3 w-3 mr-1" />
								Time-to-First-Token Optimized
							</Badge>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<ConnectionStatus status={connectionStatus} />
							{sessionId && (
								<span className="text-muted-foreground">
									Session: <code className="text-xs">{sessionId}</code>
								</span>
							)}
						</div>
					</div>
					{error && (
						<div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
							<AlertCircle className="inline h-4 w-4 mr-1" />
							{error.message}
						</div>
					)}
				</div>

				{/* Messages Area */}
				<ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
					<div className="space-y-4">
						{messages.length === 0 && (
							<div className="text-center text-muted-foreground py-8">
								<Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p>Start a conversation to see instant streaming in action!</p>
								<p className="text-sm mt-2">Try asking mathematical questions or weather queries.</p>
							</div>
						)}

						{messages.map((message) => (
							<MessageBubble key={message.id} message={message} />
						))}

						{/* Live Thinking Display */}
						{currentThinking && (
							<div className="flex gap-3">
								<Bot className="h-8 w-8 text-orange-500" />
								<div className="flex-1">
									<div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
										<div className="flex items-center gap-2 mb-1">
											<Badge variant="outline" className="text-xs bg-orange-100">
												<Loader2 className="h-3 w-3 animate-spin mr-1" />
												Thinking
											</Badge>
											<span className="text-xs text-orange-600">Live stream</span>
										</div>
										<p className="text-sm font-mono text-orange-900">
											{currentThinking}
											<span className="animate-pulse">▋</span>
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</ScrollArea>

				{/* Input Area */}
				<div className="border-t p-4">
					<div className="flex gap-2">
						<Input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder="Ask me anything..."
							disabled={isStreaming}
							className="flex-1"
						/>
						<Button onClick={sendMessage} disabled={!input.trim() || isStreaming} size="icon">
							{isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
						</Button>
					</div>
					<p className="text-xs text-muted-foreground mt-2">
						First agent loop runs instantly • Subsequent tool calls use event-driven processing
					</p>
				</div>
			</Card>
		</div>
	);
}

function MessageBubble({
	message,
}: {
	message: { id: string; role: string; content: string; isStreaming?: boolean; timestamp: Date };
}) {
	const isUser = message.role === "user";

	return (
		<div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
			{!isUser && <Bot className="h-8 w-8 text-primary" />}
			<div className={`max-w-[80%] ${isUser ? "order-first" : ""}`}>
				<div className={`rounded-lg p-3 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
					{message.isStreaming && !message.content ? (
						<div className="flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-sm">Streaming response...</span>
						</div>
					) : (
						<p className="text-sm whitespace-pre-wrap">{message.content}</p>
					)}
				</div>
				<p className="text-xs text-muted-foreground mt-1">{message.timestamp.toLocaleTimeString()}</p>
			</div>
			{isUser && <User className="h-8 w-8 text-muted-foreground" />}
		</div>
	);
}

function ConnectionStatus({ status }: { status: string }) {
	const variants: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
		connecting: {
			icon: <Loader2 className="h-3 w-3 animate-spin" />,
			label: "Connecting",
			className: "text-yellow-600",
		},
		connected: {
			icon: <div className="h-2 w-2 rounded-full bg-green-500" />,
			label: "Connected",
			className: "text-green-600",
		},
		disconnected: {
			icon: <div className="h-2 w-2 rounded-full bg-gray-400" />,
			label: "Disconnected",
			className: "text-gray-600",
		},
		error: {
			icon: <AlertCircle className="h-3 w-3" />,
			label: "Error",
			className: "text-red-600",
		},
	};

	const variant = variants[status] || variants.disconnected;

	return (
		<div className={`flex items-center gap-1 text-sm ${variant?.className || "text-gray-600"}`}>
			{variant?.icon || <div className="h-2 w-2 rounded-full bg-gray-400" />}
			<span>{variant?.label || "Disconnected"}</span>
		</div>
	);
}
