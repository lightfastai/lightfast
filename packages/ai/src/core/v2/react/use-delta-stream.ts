"use client";

import { useRef, useState, useCallback } from "react";

export enum MessageType {
	CHUNK = "chunk",
	METADATA = "metadata", 
	EVENT = "event",
	ERROR = "error",
}

export enum StreamStatus {
	INITIALIZED = "initialized",
	STREAMING = "streaming",
	COMPLETED = "completed",
	ERROR = "error",
}

export interface ChunkMessage {
	type: MessageType.CHUNK;
	content: string;
	timestamp: string;
}

export interface MetadataMessage {
	type: MessageType.METADATA;
	status: StreamStatus;
	sessionId?: string;
	timestamp: string;
}

export interface EventMessage {
	type: MessageType.EVENT;
	event: string;
	data?: any;
	timestamp: string;
}

export interface ErrorMessage {
	type: MessageType.ERROR;
	error: string;
	code?: string;
	timestamp: string;
}

export type StreamMessage = ChunkMessage | MetadataMessage | EventMessage | ErrorMessage;

export function validateMessage(data: any): StreamMessage | null {
	if (!data || typeof data !== "object" || !data.type || !data.timestamp) {
		return null;
	}

	const validTypes = Object.values(MessageType);
	if (!validTypes.includes(data.type)) {
		return null;
	}

	return data as StreamMessage;
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
		streamEndpoint = "/api/stream",
		onChunk,
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
	const connect = useCallback(async (sessionId: string) => {
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
									console.log("Raw SSE data:", data);
									console.log("Parsed SSE data:", parsedData);
									const validatedMessage = validateMessage(parsedData);
									console.log("Validated message:", validatedMessage);

									if (!validatedMessage) {
										console.log("Message validation failed for:", parsedData);
										continue;
									}

									switch (validatedMessage.type) {
										case MessageType.CHUNK:
											const chunkMessage = validatedMessage as ChunkMessage;
											streamContent.current += chunkMessage.content;
											onChunk?.(chunkMessage.content);
											break;

										case MessageType.METADATA:
											const metadataMessage = validatedMessage as MetadataMessage;

											if (metadataMessage.status === StreamStatus.COMPLETED) {
												setIsConnected(false);
												onComplete?.(streamContent.current);
											}
											break;

										case MessageType.ERROR:
											const errorMessage = validatedMessage as ErrorMessage;
											const error = new Error(errorMessage.error);
											setError(error);
											setIsConnected(false);
											onError?.(error);
											break;
									}
								} catch (e) {
									console.error("Failed to parse message:", e);
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
	}, [streamEndpoint, onChunk, onComplete, onError, maxRetries, retryDelay]);

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