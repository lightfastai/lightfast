"use client";

import { useChat } from "@lightfast/ai/v2/react";
import type { ChatStatus, UIMessage } from "ai";
import { useCallback, useState } from "react";

interface UseChatV2Options {
	agentId: string;
	threadId: string;
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
	threadId,
	initialMessages = [],
	onError,
	onChunkReceived,
	onStreamComplete,
}: UseChatV2Options): UseChatV2Return {
	const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
	const [currentResponse, setCurrentResponse] = useState("");

	// Use v2 chat hook for streaming
	const {
		status,
		response,
		messageId,
		sendMessage: v2SendMessage,
		reset,
	} = useChat({
		sessionId: threadId,
		apiEndpoint: "/api/v2/stream/init",
		streamEndpoint: "/api/v2/stream",
		onChunk: (chunk) => {
			setCurrentResponse((prev) => prev + chunk);
			onChunkReceived?.(chunk);
		},
		onComplete: (fullResponse) => {
			// Add the assistant message to messages array with server-provided ID
			const assistantMessage: UIMessage = {
				id: messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
				role: "assistant",
				parts: [{ type: "text", text: fullResponse }],
			};
			setMessages((prev) => [...prev, assistantMessage]);
			setCurrentResponse("");
			onStreamComplete?.(fullResponse);
		},
		onError: (error) => {
			console.error("Stream error:", error);
			onError?.(error);
		},
	});

	const sendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || status === "loading" || status === "streaming") {
				throw new Error("Cannot send message");
			}

			// Clear any current response state before sending new message
			setCurrentResponse("");

			// Add user message to messages array
			const userMessage: UIMessage = {
				id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
				role: "user",
				parts: [{ type: "text", text: message }],
			};
			setMessages((prev) => [...prev, userMessage]);

			// Send message for streaming - v2SendMessage will return the message ID
			// The useChat hook from v2 will handle getting the message ID from the init response
			await v2SendMessage(message);
		},
		[status, v2SendMessage],
	);

	// Map v2 status to ChatStatus
	const chatStatus: ChatStatus = (() => {
		switch (status) {
			case "loading":
				return "submitted";
			case "streaming":
				return "streaming";
			case "error":
				return "error";
			case "idle":
			case "completed":
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
