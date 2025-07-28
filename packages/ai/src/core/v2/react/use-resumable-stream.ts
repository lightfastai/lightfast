/**
 * React hook for auto-reconnecting SSE streams
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamMessage } from "../server/types";

export interface UseResumableStreamOptions {
	/** API endpoint for SSE stream */
	endpoint?: string;
	/** Auto-reconnect on disconnect (default: true) */
	autoReconnect?: boolean;
	/** Reconnect delay in ms (default: 1000) */
	reconnectDelay?: number;
	/** Max reconnect attempts (default: 10) */
	maxReconnectAttempts?: number;
	/** Persist session ID in localStorage (default: true) */
	persistSessionId?: boolean;
	/** Custom headers for the request */
	headers?: Record<string, string>;
}

export interface UseResumableStreamReturn {
	/** All messages received so far */
	messages: StreamMessage[];
	/** Current connection status */
	status: "connecting" | "connected" | "disconnected" | "error" | "completed";
	/** Error if any */
	error?: Error;
	/** Current session ID */
	sessionId?: string;
	/** Manually reconnect */
	reconnect: () => void;
	/** Clear messages and session */
	clear: () => void;
}

export function useResumableStream(
	initialSessionId?: string,
	options: UseResumableStreamOptions = {},
): UseResumableStreamReturn {
	const {
		endpoint = "/api/v2/stream",
		autoReconnect = true,
		reconnectDelay = 1000,
		maxReconnectAttempts = 10,
		persistSessionId = true,
		headers = {},
	} = options;

	// State
	const [messages, setMessages] = useState<StreamMessage[]>([]);
	const [status, setStatus] = useState<UseResumableStreamReturn["status"]>(
		initialSessionId ? "connecting" : "disconnected",
	);
	const [error, setError] = useState<Error>();
	const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);

	// Update sessionId when initialSessionId changes
	useEffect(() => {
		if (initialSessionId && initialSessionId !== sessionId) {
			setSessionId(initialSessionId);
			// Reset messages when switching to a new session
			setMessages([]);
			setError(undefined);
		}
	}, [initialSessionId]);

	// Refs for stable references
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
	const statusRef = useRef(status);

	// Keep status ref in sync
	useEffect(() => {
		statusRef.current = status;
	}, [status]);

	// Get or create session ID
	useEffect(() => {
		if (!sessionId && persistSessionId) {
			// Try to get from localStorage
			const stored = localStorage.getItem("resumable-stream-session-id");
			if (stored) {
				setSessionId(stored);
			}
		}
	}, [sessionId, persistSessionId]);

	// Save session ID to localStorage
	useEffect(() => {
		if (sessionId && persistSessionId) {
			localStorage.setItem("resumable-stream-session-id", sessionId);
		}
	}, [sessionId, persistSessionId]);

	// Connect to SSE stream
	const connect = useCallback(() => {
		if (!sessionId) {
			return;
		}

		// Clean up existing connection
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		setStatus("connecting");
		setError(undefined);

		// Create EventSource with session ID
		const url = `${endpoint}/${sessionId}`;
		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		// Handle connection open
		eventSource.onopen = () => {
			setStatus("connected");
			reconnectAttemptsRef.current = 0;
		};

		// Handle messages
		eventSource.onmessage = (event) => {
			try {
				const message: StreamMessage = JSON.parse(event.data);
				setMessages((prev: StreamMessage[]) => [...prev, message]);

				// Update status based on metadata messages
				if (message.type === "metadata") {
					if (message.status === "completed") {
						setStatus("completed");
						eventSource.close();
					}
				} else if (message.type === "error") {
					setError(new Error(message.error));
					setStatus("error");
				}
			} catch (err) {
				console.error("Failed to parse message:", err);
			}
		};

		// Handle errors
		eventSource.onerror = (event) => {
			eventSource.close();
			eventSourceRef.current = null;

			// Check if we should reconnect
			if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts && statusRef.current !== "completed") {
				setStatus("disconnected");
				reconnectAttemptsRef.current++;

				// Schedule reconnection
				reconnectTimeoutRef.current = setTimeout(() => {
					connect();
				}, reconnectDelay * Math.min(reconnectAttemptsRef.current, 5)); // Exponential backoff up to 5x
			} else {
				setStatus("error");
				setError(new Error("Connection failed"));
			}
		};
	}, [sessionId, endpoint, autoReconnect, reconnectDelay, maxReconnectAttempts]);

	// Effect to manage connection lifecycle
	useEffect(() => {
		if (sessionId) {
			connect();
		}

		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [sessionId, connect]);

	// Manual reconnect
	const reconnect = useCallback(() => {
		reconnectAttemptsRef.current = 0;
		connect();
	}, [connect]);

	// Clear messages and session
	const clear = useCallback(() => {
		setMessages([]);
		setSessionId(undefined);
		setStatus("disconnected");
		setError(undefined);

		if (persistSessionId) {
			localStorage.removeItem("resumable-stream-session-id");
		}

		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
	}, [persistSessionId]);

	return {
		messages,
		status,
		error,
		sessionId,
		reconnect,
		clear,
	};
}

// Helper hook to filter messages by type
export function useStreamMessages(messages: StreamMessage[], type: "chunk"): string;
export function useStreamMessages<T extends StreamMessage["type"]>(
	messages: StreamMessage[],
	type: T,
): Extract<StreamMessage, { type: T }>[];
export function useStreamMessages(messages: StreamMessage[], type: StreamMessage["type"]) {
	if (type === "chunk") {
		// Special case: concatenate all chunk contents
		return messages
			.filter((m): m is Extract<StreamMessage, { type: "chunk" }> => m.type === "chunk")
			.map((m) => m.content)
			.join("");
	}

	return messages.filter((m) => m.type === type);
}
