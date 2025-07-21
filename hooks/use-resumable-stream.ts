import { useCallback, useRef, useState } from "react";
import { ResumableStreamClient } from "@/lib/resumable-stream-client";

interface UseResumableStreamOptions {
	onMessage?: (message: any) => void;
	onError?: (error: Error) => void;
	onComplete?: () => void;
	maxRetries?: number;
	retryDelay?: number;
}

export function useResumableStream(options: UseResumableStreamOptions = {}) {
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const clientRef = useRef<ResumableStreamClient | null>(null);

	const startStream = useCallback(
		async (url: string, body: any) => {
			// Clean up any existing stream
			if (clientRef.current) {
				clientRef.current.abort();
			}

			setIsStreaming(true);
			setError(null);

			clientRef.current = new ResumableStreamClient({
				...options,
				onError: (error) => {
					setError(error);
					setIsStreaming(false);
					options.onError?.(error);
				},
				onComplete: () => {
					setIsStreaming(false);
					options.onComplete?.();
				},
			});

			try {
				await clientRef.current.start(url, body);
			} catch (err) {
				setError(err as Error);
				setIsStreaming(false);
			}
		},
		[options],
	);

	const abort = useCallback(() => {
		if (clientRef.current) {
			clientRef.current.abort();
			clientRef.current = null;
			setIsStreaming(false);
		}
	}, []);

	return {
		startStream,
		abort,
		isStreaming,
		error,
	};
}

// Example usage in a component:
/*
function ChatComponent() {
	const { startStream, abort, isStreaming, error } = useResumableStream({
		onMessage: (message) => {
			// Handle incoming message
			console.log("New message:", message);
		},
		onError: (error) => {
			// Handle error
			console.error("Stream error:", error);
		},
		onComplete: () => {
			// Handle completion
			console.log("Stream completed");
		},
		maxRetries: 5,
		retryDelay: 2000,
	});

	const handleSendMessage = async (content: string) => {
		await startStream("/api/chat/agentId/threadId", {
			messages: [{ role: "user", content }],
			threadId: "thread-123",
		});
	};

	return (
		<div>
			{isStreaming && <button onClick={abort}>Stop</button>}
			{error && <div>Error: {error.message}</div>}
		</div>
	);
}
*/
