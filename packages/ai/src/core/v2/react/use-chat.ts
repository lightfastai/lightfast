"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type DeltaStreamMessage, DeltaStreamType } from "../server/stream/types";
import { useDeltaStream, validateMessage } from "./use-delta-stream";

// Re-export types for convenience
export { DeltaStreamType, type DeltaStreamMessage, validateMessage };

export interface UseChatOptions {
	apiEndpoint?: string;
	streamEndpoint?: string;
	sessionId: string;
	onChunk?: (chunk: string) => void;
	onComplete?: (response: string) => void;
	onError?: (error: Error) => void;
}

export interface UseChatReturn {
	// State
	sessionId: string;
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
		onChunk,
		onComplete,
		onError,
	} = options;
	const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "completed" | "error">("idle");
	const [response, setResponse] = useState("");
	const [chunkCount, setChunkCount] = useState(0);

	// Refs
	const responseRef = useRef<HTMLDivElement>(null);

	// Delta stream hook
	const deltaStream = useDeltaStream({
		streamEndpoint,
		onChunk: (chunk: string) => {
			setResponse((prev) => prev + chunk);
			setChunkCount((prev) => prev + 1);
			onChunk?.(chunk);
		},
		onComplete: (fullResponse: string) => {
			setStatus("completed");
			onComplete?.(fullResponse);
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
				setStatus("loading");
				setResponse("");
				setChunkCount(0);

				// Start the stream
				await fetch(apiEndpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ prompt, sessionId }),
				});

				// Connect to the delta stream
				await deltaStream.connect(sessionId);
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
	}, [deltaStream]);

	return {
		// State
		sessionId,
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
