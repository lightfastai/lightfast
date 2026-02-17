"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	
	DeltaStreamType
	
	
} from "../server/stream/types";
import type {DeltaStreamMessage, ToolCallPart, ToolResultPart} from "../server/stream/types";
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
	onToolResult?: (toolResult: ToolResultPart) => void;
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
		onToolResult,
		onComplete,
		onError,
	} = options;
	const [status, setStatus] = useState<
		"idle" | "loading" | "streaming" | "completed" | "error"
	>("idle");
	const [response, setResponse] = useState("");
	const [chunkCount, setChunkCount] = useState(0);
	const [messageId, setMessageId] = useState<string | undefined>();
	const [messages, setMessages] = useState<UIMessage[]>(initialMessages);

	// Refs
	const responseRef = useRef<HTMLDivElement>(null);
	const messageIdRef = useRef<string | undefined>(undefined);
	const messagePartsRef = useRef<
		{
			type: "text" | "tool-call";
			text?: string;
			toolCall?: ToolCallPart;
			toolResult?: ToolResultPart;
		}[]
	>([]);
	const isStreamingMessageAddedRef = useRef<boolean>(false);

	// Helper to update streaming message with current parts
	const updateStreamingMessage = () => {
		const currentMessageId = messageIdRef.current;
		if (!currentMessageId) return;

		// Convert accumulated parts to UIMessage parts format
		const parts: any[] = messagePartsRef.current
			.map((part) => {
				if (part.type === "text") {
					return { type: "text", text: part.text || "" };
				} else if (part.type === "tool-call" && part.toolCall) {
					// Convert tool call to UI format with proper type and state
					const toolCall = part.toolCall;
					const hasResult = part.toolResult !== undefined;
					const isError =
						hasResult &&
						part.toolResult?.result &&
						typeof part.toolResult.result === "object" &&
						"error" in part.toolResult.result;

					if (hasResult && part.toolResult) {
						// Tool has been executed and has a result
						if (isError) {
							return {
								type: `tool-${toolCall.toolName}`,
								toolCallId: toolCall.toolCallId,
								state: "output-error",
								errorText: part.toolResult.result.error,
							};
						} else {
							return {
								type: `tool-${toolCall.toolName}`,
								toolCallId: toolCall.toolCallId,
								state: "output-available",
								input: toolCall.args,
								output: part.toolResult.result,
							};
						}
					} else {
						// Tool call is still pending
						return {
							type: `tool-${toolCall.toolName}`,
							toolCallId: toolCall.toolCallId,
							state: "partial-call",
							input: toolCall.args,
						};
					}
				}
				return null;
			})
			.filter(Boolean);

		// Update or add the assistant message
		setMessages((prev) => {
			const existingIndex = prev.findIndex(
				(msg) => msg.id === currentMessageId,
			);
			const assistantMessage: UIMessage = {
				id: currentMessageId,
				role: "assistant",
				parts: parts.length > 0 ? parts : [],
			};

			if (existingIndex >= 0) {
				// Update existing message
				const newMessages = [...prev];
				newMessages[existingIndex] = assistantMessage;
				return newMessages;
			} else {
				// Add new message
				isStreamingMessageAddedRef.current = true;
				return [...prev, assistantMessage];
			}
		});
	};

	// Delta stream hook
	const deltaStream = useDeltaStream({
		streamEndpoint,
		onChunk: (chunk: string) => {
			setResponse((prev) => prev + chunk);
			setChunkCount((prev) => prev + 1);
			// Accumulate text in the current part
			const lastPart =
				messagePartsRef.current[messagePartsRef.current.length - 1];
			if (lastPart?.type !== "text") {
				messagePartsRef.current.push({ type: "text", text: chunk });
			} else {
				lastPart.text = (lastPart.text || "") + chunk;
			}
			// Update the streaming message in real-time
			updateStreamingMessage();
			onChunk?.(chunk);
		},
		onToolCall: (toolCall: ToolCallPart) => {
			console.log("[use-chat] Received TOOL_CALL:", toolCall);
			// Add tool call part
			messagePartsRef.current.push({ type: "tool-call", toolCall });
			// Update the streaming message to show tool call immediately
			updateStreamingMessage();
			onToolCall?.(toolCall);
		},
		onToolResult: (toolResult: ToolResultPart) => {
			console.log("[use-chat] Processing TOOL_RESULT:", toolResult);

			// Update the messagePartsRef to include the tool result
			// This is important because the streaming message is built from messagePartsRef
			const updatedPartsRef = messagePartsRef.current.map((part) => {
				if (
					part.type === "tool-call" &&
					part.toolCall?.toolCallId === toolResult.toolCallId
				) {
					// Add the tool result to the part
					return {
						...part,
						toolResult: toolResult,
					};
				}
				return part;
			});
			messagePartsRef.current = updatedPartsRef;

			// Now rebuild the streaming message with the updated parts
			updateStreamingMessage();

			onToolResult?.(toolResult);
		},
		onComplete: (fullResponse: string) => {
			setStatus("completed");
			const currentMessageId = messageIdRef.current;
			if (currentMessageId) {
				// Final update to ensure all parts are included
				updateStreamingMessage();
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
			if (!prompt.trim() || status === "loading" || status === "streaming")
				return;

			try {
				// Reset any existing stream state
				deltaStream.disconnect();

				setStatus("loading");
				setResponse("");
				setChunkCount(0);
				messagePartsRef.current = [];
				isStreamingMessageAddedRef.current = false;

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
					throw new Error(
						`Failed to initialize stream: ${initResponse.statusText}`,
					);
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
				const error =
					err instanceof Error ? err : new Error("Failed to send message");
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
		isStreamingMessageAddedRef.current = false;
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
