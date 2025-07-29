"use client";

/**
 * React hook for v2 chat functionality with SSE streaming
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";

// Extended UIMessage with additional client-side properties
export interface ChatMessage extends UIMessage {
	isStreaming?: boolean;
	timestamp: Date;
}

export interface UseChatOptions {
	/** URL for the unified API endpoint (e.g., "/api/v2") */
	url?: string;
	/** Initial messages */
	initialMessages?: ChatMessage[];
	/** Tools to enable */
	tools?: string[];
	/** Temperature for generation */
	temperature?: number;
	/** Max iterations for the agent */
	maxIterations?: number;
	/** System prompt override */
	systemPrompt?: string;
	/** Metadata to pass to the agent */
	metadata?: Record<string, any>;
}

export interface UseChatReturn {
	/** All messages in the conversation */
	messages: ChatMessage[];
	/** Current input value */
	input: string;
	/** Set the input value */
	setInput: (value: string) => void;
	/** Send a message */
	sendMessage: () => Promise<void>;
	/** Whether the assistant is currently streaming */
	isStreaming: boolean;
	/** Connection status */
	connectionStatus: "disconnected" | "connecting" | "connected" | "error";
	/** Current thinking content (if any) */
	currentThinking: string;
	/** Current session ID */
	sessionId?: string;
	/** Clear all messages and reset */
	clear: () => void;
	/** Error if any */
	error?: Error;
}

// Helper function to extract text content from UIMessage parts
export function getMessageContent(message: UIMessage): string {
	if (!message.parts || message.parts.length === 0) return "";
	
	return message.parts
		.filter(part => part.type === "text")
		.map(part => part.text || "")
		.join("");
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
	const {
		url = "/api/v2",
		initialMessages = [],
		tools = [],
		temperature = 0.7,
		maxIterations,
		systemPrompt,
		metadata = {},
	} = options;

	// State
	const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
	const [input, setInput] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [sessionId, setSessionId] = useState<string>();
	const [connectionStatus, setConnectionStatus] = useState<UseChatReturn["connectionStatus"]>("disconnected");
	const [currentThinking, setCurrentThinking] = useState("");
	const [error, setError] = useState<Error>();

	// Refs
	const eventSourceRef = useRef<EventSource | null>(null);
	const currentMessageIdRef = useRef<string | undefined>(undefined);

	// Clean up event source on unmount
	useEffect(() => {
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, []);

	const connectToStream = useCallback(
		(sessionId: string) => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}

			setConnectionStatus("connecting");
			const eventSource = new EventSource(`${url}/stream/${sessionId}`);
			eventSourceRef.current = eventSource;

			eventSource.onopen = () => {
				setConnectionStatus("connected");
			};

			// Handle different event types
			const handleStreamEvent = (event: MessageEvent, type: string) => {
				try {
					// Skip empty data
					if (!event.data || event.data.trim() === "") {
						return;
					}

					const data = JSON.parse(event.data);

					// Handle UIMessage events
					if (type === "message") {
						const message = data as UIMessage;
						if (message && message.parts && currentMessageIdRef.current) {
							// Update the assistant message with new parts
							setMessages((prev) =>
								prev.map((msg) => 
									msg.id === currentMessageIdRef.current 
										? { ...msg, parts: message.parts, isStreaming: false } 
										: msg
								),
							);
							
							// Check for reasoning parts
							const hasReasoning = message.parts.some(part => part.type === "reasoning");
							if (!hasReasoning) {
								setCurrentThinking("");
							} else {
								// Update thinking with latest reasoning
								const reasoningParts = message.parts.filter(part => part.type === "reasoning");
								const latestReasoning = reasoningParts[reasoningParts.length - 1];
								if (latestReasoning && latestReasoning.text) {
									setCurrentThinking(latestReasoning.text);
								}
							}
						}
						return;
					}

					// Handle UIMessagePart events
					if (type === "message-part") {
						const { part, messageId } = data;
						if (part && part.type === "reasoning") {
							setCurrentThinking((prev) => prev + (part.text || ""));
						}
						return;
					}

					// Handle system events
					if (type === "system-event") {
						const event = data;
						
						// Handle completion
						if (event.type === "metadata" && event.status === "completed") {
							setIsStreaming(false);
							setCurrentThinking("");
							// Close the EventSource when stream is completed
							if (eventSourceRef.current) {
								eventSourceRef.current.close();
								eventSourceRef.current = null;
								setConnectionStatus("disconnected");
							}
						}
						
						// Handle errors
						if (event.type === "error") {
							setError(new Error(event.error || "Unknown error"));
							setIsStreaming(false);
							setCurrentThinking("");
						}
						
						return;
					}
				} catch (err) {
					console.error("Failed to parse event:", err, "Event data:", event.data);
				}
			};

			// Listen to new UIMessage event types
			["message", "message-part", "system-event"].forEach(
				(eventType) => {
					eventSource.addEventListener(eventType, (event) => handleStreamEvent(event, eventType));
				},
			);

			eventSource.onerror = (error) => {
				console.error("EventSource error:", error);
				setConnectionStatus("error");
				setIsStreaming(false);
				setCurrentThinking("");
			};
		},
		[url],
	);

	const sendMessage = useCallback(async () => {
		if (!input.trim() || isStreaming) return;

		const userMessage: ChatMessage = {
			id: `msg_${Date.now()}_user`,
			role: "user",
			parts: [{ type: "text", text: input.trim() }],
			isStreaming: false,
			timestamp: new Date(),
		};

		const assistantMessageId = `msg_${Date.now()}_assistant`;
		const assistantMessage: ChatMessage = {
			id: assistantMessageId,
			role: "assistant",
			parts: [],
			isStreaming: true,
			timestamp: new Date(),
		};

		currentMessageIdRef.current = assistantMessageId;
		setMessages((prev) => [...prev, userMessage, assistantMessage]);
		setInput("");
		setIsStreaming(true);
		setCurrentThinking("");
		setError(undefined);

		try {
			// Call the stream init endpoint via unified route
			const response = await fetch(`${url}/stream/init`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [...messages, userMessage].map((m) => ({
						role: m.role,
						content: getMessageContent(m),
					})),
					tools,
					temperature,
					maxIterations,
					systemPrompt,
					metadata,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				throw new Error(errorData?.error || `HTTP ${response.status}`);
			}

			const data = await response.json();
			setSessionId(data.sessionId);

			// Connect to stream immediately
			connectToStream(data.sessionId);
		} catch (error) {
			console.error("Send message error:", error);
			setError(error instanceof Error ? error : new Error("Failed to send message"));
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessageId
						? {
								...msg,
								parts: [{ type: "text", text: "Sorry, an error occurred. Please try again." }],
								isStreaming: false,
							}
						: msg,
				),
			);
			setIsStreaming(false);
			setCurrentThinking("");
		}
	}, [input, isStreaming, messages, url, tools, temperature, maxIterations, systemPrompt, metadata, connectToStream]);

	const clear = useCallback(() => {
		setMessages([]);
		setInput("");
		setIsStreaming(false);
		setSessionId(undefined);
		setConnectionStatus("disconnected");
		setCurrentThinking("");
		setError(undefined);

		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
	}, []);

	return {
		messages,
		input,
		setInput,
		sendMessage,
		isStreaming,
		connectionStatus,
		currentThinking,
		sessionId,
		clear,
		error,
	};
}
