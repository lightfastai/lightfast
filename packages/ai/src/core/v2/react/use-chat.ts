"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { type DeltaStreamMessage, DeltaStreamType, type ToolCallPart } from "../server/stream/types";
import { uuidv4 } from "../utils/uuid";
import { useDeltaStream, validateMessage } from "./use-delta-stream";

// Re-export types for convenience
export { DeltaStreamType, type DeltaStreamMessage, validateMessage };

export interface UseChatOptions {
	apiEndpoint?: string;
	streamEndpoint?: string;
	sessionId?: string;
	initialMessages?: UIMessage[];
	onChunk?: (chunk: string) => void;
	onToolCall?: (toolCall: ToolCallPart) => void;
	onComplete?: (response: string, messageId: string) => void;
	onError?: (error: Error) => void;
}

export interface UseChatReturn {
	// State
	sessionId: string | undefined;
	messageId: string | undefined;
	messages: UIMessage[];
	status: "idle" | "loading" | "streaming" | "completed" | "error";
	response: string;
	chunkCount: number;
	error: Error | null;

	// Actions
	sendMessage: (prompt: string) => void;
	reset: () => void;

	// Refs for DOM manipulation
	responseRef: React.RefObject<HTMLDivElement | null>;
}

export function useChat(options: UseChatOptions): UseChatReturn {
	const {
		apiEndpoint = "/api/v2/stream/init",
		streamEndpoint = "/api/v2/stream",
		sessionId,
		initialMessages = [],
		onChunk,
		onToolCall,
		onComplete,
		onError,
	} = options;
	const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "completed" | "error">("idle");
	const [response, setResponse] = useState("");
	const [chunkCount, setChunkCount] = useState(0);
	const [messageId, setMessageId] = useState<string | undefined>();
	const [messages, setMessages] = useState<UIMessage[]>(initialMessages);

	// Refs
	const responseRef = useRef<HTMLDivElement>(null);
	const messageIdRef = useRef<string | undefined>(undefined);
	const messagePartsRef = useRef<Array<{ type: "text" | "tool-call"; text?: string; toolCall?: ToolCallPart }>>([]);

	// Delta stream hook
	const deltaStream = useDeltaStream({
		streamEndpoint,
		onChunk: (chunk: string) => {
			setResponse((prev) => prev + chunk);
			setChunkCount((prev) => prev + 1);
			// Accumulate text in the current part
			const lastPart = messagePartsRef.current[messagePartsRef.current.length - 1];
			if (!lastPart || lastPart.type !== "text") {
				messagePartsRef.current.push({ type: "text", text: chunk });
			} else {
				lastPart.text = (lastPart.text || "") + chunk;
			}
			onChunk?.(chunk);
		},
		onToolCall: (toolCall: ToolCallPart) => {
			// Add tool call part
			messagePartsRef.current.push({ type: "tool-call", toolCall });
			onToolCall?.(toolCall);
		},
		onComplete: (fullResponse: string) => {
			setStatus("completed");
			const currentMessageId = messageIdRef.current;
			if (currentMessageId) {
				// Convert accumulated parts to UIMessage parts format
				const parts: any[] = messagePartsRef.current.map((part) => {
					if (part.type === "text") {
						return { type: "text", text: part.text || "" };
					} else if (part.type === "tool-call" && part.toolCall) {
						return part.toolCall; // ToolCallPart already has the correct format
					}
					return null;
				}).filter(Boolean);

				// Add assistant message with all parts
				const assistantMessage: UIMessage = {
					id: currentMessageId,
					role: "assistant",
					parts: parts.length > 0 ? parts : [{ type: "text", text: fullResponse }],
				};
				setMessages((prev) => [...prev, assistantMessage]);
				onComplete?.(fullResponse, currentMessageId);
			}
		},
		onError: (error: Error) => {
			setStatus("error");
			onError?.(error);
		},
	});

	// Auto-scroll to bottom when response updates
	useEffect(() => {
		if (responseRef.current) {
			responseRef.current.scrollTop = responseRef.current.scrollHeight;
		}
	}, [response]);

	// Update status based on stream connection
	useEffect(() => {
		if (deltaStream.isConnected && status === "loading") {
			setStatus("streaming");
		}
	}, [deltaStream.isConnected, status]);

	// Send message function
	const sendMessage = useCallback(
		async (prompt: string) => {
			if (!prompt.trim() || status === "loading" || status === "streaming") return;

			try {
				// Reset any existing stream state
				deltaStream.disconnect();

				setStatus("loading");
				setResponse("");
				setChunkCount(0);
				messagePartsRef.current = [];

				// Add user message to messages array
				const userMessage: UIMessage = {
					id: uuidv4(),
					role: "user",
					parts: [{ type: "text", text: prompt }],
				};
				setMessages((prev) => [...prev, userMessage]);

				// Start the stream and get message ID
				const initResponse = await fetch(apiEndpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ prompt, sessionId }),
				});

				if (!initResponse.ok) {
					throw new Error(`Failed to initialize stream: ${initResponse.statusText}`);
				}

				const initData = await initResponse.json();
				const { messageId: newMessageId } = initData;

				// Store the message ID in both state and ref
				setMessageId(newMessageId);
				messageIdRef.current = newMessageId;

				// Connect to the delta stream using message ID (not session ID)
				if (newMessageId) {
					await deltaStream.connect(newMessageId);
				}
			} catch (err) {
				const error = err instanceof Error ? err : new Error("Failed to send message");
				setStatus("error");
				onError?.(error);
			}
		},
		[apiEndpoint, sessionId, deltaStream, status, onError],
	);

	// Reset function
	const reset = useCallback(() => {
		deltaStream.disconnect();
		setResponse("");
		setChunkCount(0);
		setStatus("idle");
		setMessageId(undefined);
		messageIdRef.current = undefined;
		messagePartsRef.current = [];
		setMessages([]);
	}, [deltaStream]);

	return {
		// State
		sessionId,
		messageId,
		messages,
		status,
		response,
		chunkCount,
		error: deltaStream.error,

		// Actions
		sendMessage,
		reset,

		// Refs
		responseRef,
	};
}
