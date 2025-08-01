"use client";

import { useCallback, useRef, useState } from "react";
import {
	type DeltaStreamMessage,
	DeltaStreamType,
	type ToolCallPart,
	type ToolResultPart,
} from "../server/stream/types";

export function validateMessage(data: any): DeltaStreamMessage | null {
	if (!data || typeof data !== "object" || !data.type || !data.timestamp) {
		return null;
	}

	// Check if it's a valid type
	if (!Object.values(DeltaStreamType).includes(data.type)) {
		return null;
	}

	// Validate type-specific fields
	switch (data.type) {
		case DeltaStreamType.INIT:
			// Init doesn't require additional fields
			break;
		case DeltaStreamType.CHUNK:
			if (!data.content) return null;
			break;
		case DeltaStreamType.TOOL_CALL:
			if (!data.toolCall) return null;
			// Parse the JSON string back to object
			try {
				const toolCall = typeof data.toolCall === "string" ? JSON.parse(data.toolCall) : data.toolCall;
				data.toolCall = toolCall;
			} catch {
				return null;
			}
			break;
		case DeltaStreamType.TOOL_RESULT:
			if (!data.toolResult) return null;
			// Parse the JSON string back to object
			try {
				const toolResult = typeof data.toolResult === "string" ? JSON.parse(data.toolResult) : data.toolResult;
				data.toolResult = toolResult;
			} catch {
				return null;
			}
			break;
		case DeltaStreamType.ERROR:
			if (!data.error) return null;
			break;
		case DeltaStreamType.COMPLETE:
			// Complete doesn't require additional fields
			break;
		default:
			return null;
	}

	return data as DeltaStreamMessage;
}

// Precondition failed error for stream not ready
class PreconditionFailedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PreconditionFailedError";
	}
}

export interface UseDeltaStreamOptions {
	streamEndpoint?: string;
	onChunk?: (chunk: string) => void;
	onToolCall?: (toolCall: ToolCallPart) => void;
	onToolResult?: (toolResult: ToolResultPart) => void;
	onComplete?: (response: string) => void;
	onError?: (error: Error) => void;
	maxRetries?: number;
	retryDelay?: number;
}

export interface UseDeltaStreamReturn {
	// State
	isConnected: boolean;
	error: Error | null;

	// Actions
	connect: (sessionId: string) => Promise<void>;
	disconnect: () => void;
}

export function useDeltaStream(options: UseDeltaStreamOptions = {}): UseDeltaStreamReturn {
	const {
		streamEndpoint = "/api/v2/stream",
		onChunk,
		onToolCall,
		onToolResult,
		onComplete,
		onError,
		maxRetries = 10,
		retryDelay = 1000,
	} = options;

	// State
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// Refs
	const controller = useRef<AbortController | null>(null);
	const streamContent = useRef<string>("");

	// Connect to stream
	const connect = useCallback(
		async (sessionId: string) => {
			let retryCount = 0;

			const attemptConnection = async (): Promise<void> => {
				try {
					setError(null);
					streamContent.current = "";

					const abortController = new AbortController();
					controller.current = abortController;

					const res = await fetch(`${streamEndpoint}/${sessionId}`, {
						headers: { "Content-Type": "text/event-stream" },
						signal: controller.current.signal,
					});

					if (res.status === 412) {
						// Stream is not yet ready, retry connection
						if (retryCount < maxRetries) {
							retryCount++;
							setTimeout(() => attemptConnection(), retryDelay);
							return;
						} else {
							throw new PreconditionFailedError("Stream not ready after max retries");
						}
					}

					if (!res.ok) {
						throw new Error(`HTTP ${res.status}: ${res.statusText}`);
					}

					if (!res.body) return;

					setIsConnected(true);

					const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();

					while (true) {
						const { value, done } = await reader.read();

						if (done) break;

						if (value) {
							const messages = value.split("\n\n").filter(Boolean);

							for (const message of messages) {
								if (message.startsWith("data: ")) {
									const data = message.slice(6);
									try {
										const parsedData = JSON.parse(data);
										const validatedMessage = validateMessage(parsedData);

										if (!validatedMessage) {
											continue;
										}

										switch (validatedMessage.type) {
											case DeltaStreamType.INIT: {
												// Stream initialized - can be used for UI feedback
												break;
											}

											case DeltaStreamType.CHUNK: {
												if (validatedMessage.content) {
													streamContent.current += validatedMessage.content;
													onChunk?.(validatedMessage.content);
												}
												break;
											}

											case DeltaStreamType.TOOL_CALL: {
												if (validatedMessage.toolCall) {
													onToolCall?.(validatedMessage.toolCall);
												}
												break;
											}

											case DeltaStreamType.TOOL_RESULT: {
												if (validatedMessage.toolResult) {
													console.log("[use-delta-stream] Received TOOL_RESULT:", validatedMessage.toolResult);
													onToolResult?.(validatedMessage.toolResult);
												}
												break;
											}

											case DeltaStreamType.COMPLETE: {
												setIsConnected(false);
												onComplete?.(streamContent.current);
												break;
											}

											case DeltaStreamType.ERROR: {
												if (validatedMessage.error) {
													const error = new Error(validatedMessage.error);
													setError(error);
													setIsConnected(false);
													onError?.(error);
												}
												break;
											}
										}
									} catch (e) {
										// Silently ignore malformed messages
									}
								}
							}
						}
					}

					setIsConnected(false);
				} catch (err) {
					setIsConnected(false);

					if (err instanceof PreconditionFailedError && retryCount < maxRetries) {
						retryCount++;
						setTimeout(() => attemptConnection(), retryDelay);
					} else {
						const error = err instanceof Error ? err : new Error("Stream connection failed");
						setError(error);
						onError?.(error);
					}
				}
			};

			await attemptConnection();
		},
		[streamEndpoint, onChunk, onToolCall, onToolResult, onComplete, onError, maxRetries, retryDelay],
	);

	// Disconnect from stream
	const disconnect = useCallback(() => {
		controller.current?.abort();
		setIsConnected(false);
		setError(null);
		streamContent.current = "";
	}, []);

	return {
		// State
		isConnected,
		error,

		// Actions
		connect,
		disconnect,
	};
}
