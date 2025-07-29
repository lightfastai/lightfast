/**
 * SSE streaming routes
 * Provides real-time updates from Redis streams
 */

import { type DeltaStreamMessage, DeltaStreamType } from "@lightfast/ai/v2/core";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { streamConsumer } from "../config";

const streamRoutes = new Hono();

// GET /stream/:sessionId - SSE endpoint for real-time updates
streamRoutes.get("/:sessionId", async (c) => {
	const sessionId = c.req.param("sessionId");
	const lastEventId = c.req.header("last-event-id");

	console.log(`Client connected to stream ${sessionId}, lastEventId: ${lastEventId}`);

	return streamSSE(c, async (stream) => {
		try {
			// Create abort controller for cleanup
			const controller = new AbortController();

			// Handle client disconnect
			stream.onAbort(() => {
				console.log(`Client disconnected from stream ${sessionId}`);
				controller.abort();
			});

			// Start consuming from Redis stream
			await streamConsumer.consumeDeltaStream(
				sessionId,
				controller.signal,
				async (message: DeltaStreamMessage) => {
					// Format the message for SSE based on type
					let data: any = {};

					switch (message.type) {
						case DeltaStreamType.INIT:
							data = { initialized: true, timestamp: message.timestamp };
							break;
						case DeltaStreamType.CHUNK:
							data = { content: message.content };
							break;
						case DeltaStreamType.ERROR:
							data = { error: message.error };
							break;
						case DeltaStreamType.COMPLETE:
							data = { completed: true, timestamp: message.timestamp };
							break;
					}

					await stream.writeSSE({
						data: JSON.stringify(data),
						event: message.type,
						id: Date.now().toString(),
					});
				},
				async (error: Error) => {
					console.error(`Stream error for ${sessionId}:`, error);
					await stream.writeSSE({
						event: "error",
						data: JSON.stringify({
							error: error.message,
							timestamp: new Date().toISOString(),
						}),
					});
				},
				async () => {
					await stream.writeSSE({
						event: "complete",
						data: JSON.stringify({
							message: "Stream completed",
							timestamp: new Date().toISOString(),
						}),
					});
				},
			);
		} catch (error) {
			console.error(`Failed to start stream for ${sessionId}:`, error);
			await stream.writeSSE({
				event: "error",
				data: JSON.stringify({
					error: "Failed to start stream",
					details: error instanceof Error ? error.message : String(error),
				}),
			});
		}
	});
});

export { streamRoutes };
