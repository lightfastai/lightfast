interface ResumableStreamOptions {
	onMessage?: (message: any) => void;
	onError?: (error: Error) => void;
	onComplete?: () => void;
	maxRetries?: number;
	retryDelay?: number;
}

export class ResumableStreamClient {
	private streamId: string | null = null;
	private retryCount = 0;
	private options: Required<ResumableStreamOptions>;
	private abortController: AbortController | null = null;

	constructor(options: ResumableStreamOptions = {}) {
		this.options = {
			onMessage: options.onMessage || (() => {}),
			onError: options.onError || ((error) => console.error("Stream error:", error)),
			onComplete: options.onComplete || (() => {}),
			maxRetries: options.maxRetries || 3,
			retryDelay: options.retryDelay || 1000,
		};
	}

	async start(url: string, body: any) {
		try {
			this.abortController = new AbortController();

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				signal: this.abortController.signal,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Get stream ID from response header
			this.streamId = response.headers.get("X-Stream-Id");

			await this.handleStream(response);
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "AbortError") {
					console.log("Stream aborted");
					return;
				}

				// Attempt to resume if we have a stream ID
				if (this.streamId && this.retryCount < this.options.maxRetries) {
					await this.resume();
				} else {
					this.options.onError(error);
				}
			}
		}
	}

	async resume() {
		if (!this.streamId) {
			this.options.onError(new Error("No stream ID available for resumption"));
			return;
		}

		this.retryCount++;
		console.log(`Attempting to resume stream (attempt ${this.retryCount}/${this.options.maxRetries})`);

		// Wait before retrying
		await new Promise((resolve) => setTimeout(resolve, this.options.retryDelay));

		try {
			this.abortController = new AbortController();

			const response = await fetch(`/api/chat/resume/${this.streamId}`, {
				signal: this.abortController.signal,
			});

			if (!response.ok) {
				throw new Error(`Failed to resume stream: ${response.status}`);
			}

			await this.handleStream(response);
		} catch (error) {
			if (error instanceof Error) {
				if (this.retryCount < this.options.maxRetries) {
					await this.resume();
				} else {
					this.options.onError(error);
				}
			}
		}
	}

	private async handleStream(response: Response) {
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("No response body");
		}

		const decoder = new TextDecoder();
		let buffer = "";

		try {
			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					this.options.onComplete();
					break;
				}

				buffer += decoder.decode(value, { stream: true });

				// Process SSE messages
				const messages = buffer.split("\n\n");
				buffer = messages.pop() || "";

				for (const message of messages) {
					if (message.startsWith("data: ")) {
						const data = message.slice(6);
						if (data === "[DONE]") {
							this.options.onComplete();
							return;
						}

						try {
							const parsed = JSON.parse(data);
							this.options.onMessage(parsed);
						} catch (e) {
							console.error("Failed to parse message:", e);
						}
					}
				}
			}
		} catch (error) {
			if (error instanceof Error && error.name !== "AbortError") {
				throw error;
			}
		} finally {
			reader.releaseLock();
		}
	}

	abort() {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
	}
}

// Example usage:
/*
const client = new ResumableStreamClient({
	onMessage: (message) => {
		console.log("Received:", message);
		// Update UI with message
	},
	onError: (error) => {
		console.error("Stream error:", error);
		// Show error to user
	},
	onComplete: () => {
		console.log("Stream completed");
		// Update UI state
	},
	maxRetries: 5,
	retryDelay: 2000,
});

// Start streaming
await client.start("/api/chat/agentId/threadId", {
	messages: [{ role: "user", content: "Hello" }],
	threadId: "thread-123",
});

// To abort the stream
client.abort();
*/
