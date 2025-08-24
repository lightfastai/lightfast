"use client";

import { useChat } from "lightfast/v2/react";
import type { ChatStatus, UIMessage } from "ai";
import { useCallback, useState } from "react";

interface UseChatV2Options {
	agentId: string;
	sessionId: string;
	initialMessages?: UIMessage[];
	onError?: (error: Error) => void;
	onChunkReceived?: (chunk: string) => void;
	onStreamComplete?: (fullResponse: string) => void;
}

interface UseChatV2Return {
	messages: UIMessage[];
	sendMessage: (message: string) => Promise<void>;
	status: ChatStatus;
	isLoading: boolean;
	currentResponse: string;
}

export function useChatV2({
	agentId,
	sessionId,
	initialMessages = [],
	onError,
	onChunkReceived,
	onStreamComplete,
}: UseChatV2Options): UseChatV2Return {
	const [currentResponse, setCurrentResponse] = useState("");
	const [isProcessingMessage, setIsProcessingMessage] = useState(false);

	// Use v2 chat hook for streaming
	const {
		status,
		response,
		messages,
		messageId,
		sendMessage: v2SendMessage,
		reset,
	} = useChat({
		sessionId,
		initialMessages,
		apiEndpoint: "/api/v2/stream/init",
		streamEndpoint: "/api/v2/stream",
		onChunk: (chunk) => {
			setCurrentResponse((prev) => prev + chunk);
			onChunkReceived?.(chunk);
		},
		onToolCall: (toolCall) => {
			// Tool calls are handled internally by useChat and added to messages
			console.log("[useChatV2] Tool call received:", toolCall);
		},
		onComplete: (fullResponse, serverMessageId) => {
			setCurrentResponse("");
			setIsProcessingMessage(false); // Reset processing state
			onStreamComplete?.(fullResponse);
		},
		onError: (error) => {
			console.error("Stream error:", error);
			setIsProcessingMessage(false); // Reset processing state on error
			onError?.(error);
		},
	});

	const sendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || status === "loading" || status === "streaming") {
				throw new Error("Cannot send message");
			}

			// Set processing state to ensure "Thinking" persists
			setIsProcessingMessage(true);

			// Clear any current response state before sending new message
			setCurrentResponse("");

			try {
				// Send message for streaming - v2SendMessage will handle adding the user message
				// The useChat hook from v2 will handle getting the message ID from the init response
				await v2SendMessage(message);
			} catch (error) {
				// Reset processing state on error
				setIsProcessingMessage(false);
				throw error;
			}
		},
		[status, v2SendMessage],
	);

	// Map v2 status to ChatStatus with persistent "Thinking" state
	const chatStatus: ChatStatus = (() => {
		// If we're processing a message, always show "submitted" (Thinking) until we get content or complete
		if (isProcessingMessage && !currentResponse) {
			return "submitted"; // Shows "Thinking"
		}

		switch (status) {
			case "loading":
				return "submitted"; // Shows "Thinking"
			case "streaming":
				return "streaming"; // Shows "streaming"
			case "error":
				return "error";
			case "completed":
			case "idle":
			default:
				return "ready";
		}
	})();

	return {
		messages,
		sendMessage,
		status: chatStatus,
		isLoading: status === "loading" || status === "streaming",
		currentResponse,
	};
}
