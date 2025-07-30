"use client";

import { useChat } from "@lightfast/ai/v2/react";
import { AlertCircle, Bot, Loader2, Send, User, Zap } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TestInstantStreamPage() {
	const [input, setInput] = useState("");
	const sessionId = useMemo(() => `session-${Date.now()}-${Math.random().toString(36).substring(7)}`, []);
	const { status, response, chunkCount, error, sendMessage, reset, responseRef } = useChat({
		sessionId,
		apiEndpoint: "/api/v2/stream/init",
		streamEndpoint: "/api/v2/stream",
		onChunk: (chunk) => {
			console.log("Received chunk:", chunk);
		},
		onComplete: (fullResponse) => {
			console.log("Stream completed:", fullResponse);
		},
		onError: (error) => {
			console.error("Stream error:", error);
		},
	});

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (input.trim()) {
				sendMessage(input);
				setInput("");
			}
		}
	};

	const handleSendClick = () => {
		if (input.trim()) {
			sendMessage(input);
			setInput("");
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
							<StatusBadge status={status} />
							{sessionId && (
								<span className="text-muted-foreground">
									Session: <code className="text-xs">{sessionId}</code>
								</span>
							)}
							{chunkCount > 0 && (
								<span className="text-muted-foreground">
									Chunks: <code className="text-xs">{chunkCount}</code>
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
				<div className="flex-1 p-4 overflow-hidden">
					<div className="h-full">
						{!response && status === "idle" && (
							<div className="text-center text-muted-foreground py-8">
								<Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p>Start a conversation to see instant streaming in action!</p>
								<p className="text-sm mt-2">Try asking mathematical questions or weather queries.</p>
							</div>
						)}

						{(response || status !== "idle") && (
							<div className="space-y-4">
								{/* Status indicator */}
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Bot className="h-4 w-4" />
									<span>AI Assistant</span>
									{status === "streaming" && (
										<Badge variant="outline" className="text-xs">
											<Loader2 className="h-3 w-3 animate-spin mr-1" />
											Streaming
										</Badge>
									)}
									{status === "completed" && (
										<Badge variant="outline" className="text-xs bg-green-50 text-green-700">
											Completed
										</Badge>
									)}
								</div>

								{/* Response Area */}
								<div ref={responseRef} className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
									{response ? (
										<p className="text-sm whitespace-pre-wrap">
											{response}
											{status === "streaming" && <span className="animate-pulse">▋</span>}
										</p>
									) : status === "loading" ? (
										<div className="flex items-center gap-2 text-muted-foreground">
											<Loader2 className="h-4 w-4 animate-spin" />
											<span>Initializing stream...</span>
										</div>
									) : null}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Input Area */}
				<div className="border-t p-4">
					<div className="flex gap-2">
						<Input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder="Ask me anything..."
							disabled={status === "loading" || status === "streaming"}
							className="flex-1"
						/>
						<Button
							onClick={handleSendClick}
							disabled={!input.trim() || status === "loading" || status === "streaming"}
							size="icon"
						>
							{status === "loading" || status === "streaming" ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
						</Button>
						<Button
							onClick={reset}
							variant="outline"
							size="icon"
							disabled={status === "loading" || status === "streaming"}
						>
							Reset
						</Button>
					</div>
					<p className="text-xs text-muted-foreground mt-2">
						Delta streaming with real-time chunk updates • Status: {status}
					</p>
				</div>
			</Card>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const variants: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
		idle: {
			icon: <div className="h-2 w-2 rounded-full bg-gray-400" />,
			label: "Idle",
			className: "text-gray-600",
		},
		loading: {
			icon: <Loader2 className="h-3 w-3 animate-spin" />,
			label: "Loading",
			className: "text-yellow-600",
		},
		streaming: {
			icon: <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />,
			label: "Streaming",
			className: "text-blue-600",
		},
		completed: {
			icon: <div className="h-2 w-2 rounded-full bg-green-500" />,
			label: "Completed",
			className: "text-green-600",
		},
		error: {
			icon: <AlertCircle className="h-3 w-3" />,
			label: "Error",
			className: "text-red-600",
		},
	};

	const variant = variants[status] ??
		variants.idle ?? {
			icon: <div className="h-2 w-2 rounded-full bg-gray-400" />,
			label: "Unknown",
			className: "text-gray-600",
		};

	return (
		<div className={`flex items-center gap-1 text-sm ${variant.className}`}>
			{variant.icon}
			<span>{variant.label}</span>
		</div>
	);
}
