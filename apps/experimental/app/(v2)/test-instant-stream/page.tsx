"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bot, Loader2, Send, User, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	isStreaming?: boolean;
	timestamp: Date;
}

interface StreamEvent {
	id: string;
	type: 'chunk' | 'status' | 'event' | 'tool' | 'thinking' | 'error' | 'complete' | 'completion' | 'metadata';
	content: string;
	metadata?: Record<string, any>;
}

export default function TestInstantStreamPage() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [sessionId, setSessionId] = useState<string>();
	const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
	const [currentThinking, setCurrentThinking] = useState("");
	
	const eventSourceRef = useRef<EventSource | null>(null);
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const currentMessageIdRef = useRef<string | undefined>(undefined);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollAreaRef.current) {
			scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
		}
	}, [messages, currentThinking]);

	// Clean up event source on unmount
	useEffect(() => {
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, []);

	const connectToStream = useCallback((sessionId: string) => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		setConnectionStatus('connecting');
		const eventSource = new EventSource(`/api/v2/stream/${sessionId}`);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setConnectionStatus('connected');
		};

		// Handle different event types
		const handleStreamEvent = (event: MessageEvent, type: string) => {
			try {
				const data = JSON.parse(event.data);
				
				// Handle thinking events - show in real-time
				if (type === 'thinking') {
					setCurrentThinking(prev => prev + (data.content || ''));
					return;
				}

				// Handle chunk events - these are the final responses
				if (type === 'chunk' && data.content && !data.content.includes('Session initialized')) {
					const messageId = currentMessageIdRef.current;
					if (messageId) {
						setMessages(prev => prev.map(msg => 
							msg.id === messageId 
								? { ...msg, content: data.content, isStreaming: false }
								: msg
						));
						setCurrentThinking("");
					}
				}

				// Handle completion
				if (type === 'complete' || type === 'completion' || 
					(type === 'metadata' && data.status === 'completed')) {
					setIsStreaming(false);
					setCurrentThinking("");
				}

				// Handle tool events
				if (type === 'tool') {
					console.log('Tool event:', data);
				}

			} catch (err) {
				console.error('Failed to parse event:', err);
			}
		};

		// Listen to all event types
		['chunk', 'status', 'event', 'tool', 'thinking', 'error', 'complete', 'completion', 'metadata'].forEach(eventType => {
			eventSource.addEventListener(eventType, (event) => handleStreamEvent(event, eventType));
		});

		eventSource.onerror = (error) => {
			console.error('EventSource error:', error);
			setConnectionStatus('error');
			setIsStreaming(false);
			setCurrentThinking("");
		};
	}, []);

	const sendMessage = async () => {
		if (!input.trim() || isStreaming) return;

		const userMessage: Message = {
			id: `msg_${Date.now()}_user`,
			role: 'user',
			content: input.trim(),
			timestamp: new Date(),
		};

		const assistantMessageId = `msg_${Date.now()}_assistant`;
		const assistantMessage: Message = {
			id: assistantMessageId,
			role: 'assistant',
			content: '',
			isStreaming: true,
			timestamp: new Date(),
		};

		currentMessageIdRef.current = assistantMessageId;
		setMessages(prev => [...prev, userMessage, assistantMessage]);
		setInput("");
		setIsStreaming(true);
		setCurrentThinking("");

		try {
			// Call the stream init endpoint for instant streaming
			const response = await fetch('/api/v2/stream/init', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [...messages, userMessage].map(m => ({
						role: m.role,
						content: m.content,
					})),
					tools: ['calculator', 'weather'],
					temperature: 0.7,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data = await response.json();
			setSessionId(data.sessionId);
			
			// Connect to stream immediately
			connectToStream(data.sessionId);

		} catch (error) {
			console.error('Send message error:', error);
			setMessages(prev => prev.map(msg => 
				msg.id === assistantMessageId 
					? { ...msg, content: 'Sorry, an error occurred. Please try again.', isStreaming: false }
					: msg
			));
			setIsStreaming(false);
			setCurrentThinking("");
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
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
						<Button 
							onClick={sendMessage} 
							disabled={!input.trim() || isStreaming}
							size="icon"
						>
							{isStreaming ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
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

function MessageBubble({ message }: { message: Message }) {
	const isUser = message.role === 'user';
	
	return (
		<div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
			{!isUser && <Bot className="h-8 w-8 text-primary" />}
			<div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
				<div className={`rounded-lg p-3 ${
					isUser 
						? 'bg-primary text-primary-foreground' 
						: 'bg-muted'
				}`}>
					{message.isStreaming && !message.content ? (
						<div className="flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-sm">Streaming response...</span>
						</div>
					) : (
						<p className="text-sm whitespace-pre-wrap">{message.content}</p>
					)}
				</div>
				<p className="text-xs text-muted-foreground mt-1">
					{message.timestamp.toLocaleTimeString()}
				</p>
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
			className: "text-yellow-600" 
		},
		connected: { 
			icon: <div className="h-2 w-2 rounded-full bg-green-500" />, 
			label: "Connected", 
			className: "text-green-600" 
		},
		disconnected: { 
			icon: <div className="h-2 w-2 rounded-full bg-gray-400" />, 
			label: "Disconnected", 
			className: "text-gray-600" 
		},
		error: { 
			icon: <AlertCircle className="h-3 w-3" />, 
			label: "Error", 
			className: "text-red-600" 
		},
	};

	const variant = variants[status] || variants.disconnected;

	return (
		<div className={`flex items-center gap-1 text-sm ${variant?.className || 'text-gray-600'}`}>
			{variant?.icon || <div className="h-2 w-2 rounded-full bg-gray-400" />}
			<span>{variant?.label || 'Disconnected'}</span>
		</div>
	);
}