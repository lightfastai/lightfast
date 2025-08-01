"use client";

import { useCallback, useRef, useState } from "react";
import { type AgentEvent, EventName } from "../server/events/types";

export interface UseEventStreamOptions {
	streamEndpoint?: string;
	onEvent?: (event: AgentEvent) => void;
	onError?: (error: Error) => void;
	filter?: (event: AgentEvent) => boolean;
}

export interface UseEventStreamReturn {
	// State
	isConnected: boolean;
	error: Error | null;
	events: AgentEvent[];

	// Actions
	connect: (sessionId: string) => Promise<void>;
	disconnect: () => void;
	clearEvents: () => void;
}

export function useEventStream(options: UseEventStreamOptions = {}): UseEventStreamReturn {
	const { streamEndpoint = "/api/v2/events", onEvent, onError, filter } = options;

	// State
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [events, setEvents] = useState<AgentEvent[]>([]);

	// Refs
	const controller = useRef<AbortController | null>(null);

	// Connect to event stream
	const connect = useCallback(
		async (sessionId: string) => {
			try {
				setError(null);

				const abortController = new AbortController();
				controller.current = abortController;

				const res = await fetch(`${streamEndpoint}/${sessionId}`, {
					headers: { "Content-Type": "text/event-stream" },
					signal: controller.current.signal,
				});

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
									const event = JSON.parse(data) as AgentEvent;
									console.log("Received event:", event);

									// Apply filter if provided
									if (!filter || filter(event)) {
										// Update events array
										setEvents((prev) => [...prev, event]);

										// Call event handler
										onEvent?.(event);
									}
								} catch (e) {
									console.error("Failed to parse event:", e);
								}
							}
						}
					}
				}

				setIsConnected(false);
			} catch (err) {
				setIsConnected(false);
				const error = err instanceof Error ? err : new Error("Event stream connection failed");
				setError(error);
				onError?.(error);
			}
		},
		[streamEndpoint, onEvent, onError, filter],
	);

	// Disconnect from stream
	const disconnect = useCallback(() => {
		controller.current?.abort();
		setIsConnected(false);
		setError(null);
	}, []);

	// Clear events
	const clearEvents = useCallback(() => {
		setEvents([]);
	}, []);

	return {
		// State
		isConnected,
		error,
		events,

		// Actions
		connect,
		disconnect,
		clearEvents,
	};
}

// Utility hooks for specific event types

export function useAgentLoopEvents(options: Omit<UseEventStreamOptions, "filter"> = {}) {
	return useEventStream({
		...options,
		filter: (event) => event.name === EventName.AGENT_LOOP_START || event.name === EventName.AGENT_LOOP_COMPLETE,
	});
}

export function useAgentToolEvents(options: Omit<UseEventStreamOptions, "filter"> = {}) {
	return useEventStream({
		...options,
		filter: (event) => event.name === EventName.AGENT_TOOL_CALL || event.name === EventName.AGENT_TOOL_RESULT,
	});
}

export function useAgentStepEvents(options: Omit<UseEventStreamOptions, "filter"> = {}) {
	return useEventStream({
		...options,
		filter: (event) => event.name === EventName.AGENT_STEP_START || event.name === EventName.AGENT_STEP_COMPLETE,
	});
}

export function useAgentErrorEvents(options: Omit<UseEventStreamOptions, "filter"> = {}) {
	return useEventStream({
		...options,
		filter: (event) => event.name === EventName.AGENT_ERROR,
	});
}
