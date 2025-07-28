/**
 * SSE streaming routes
 * Provides real-time updates from Redis streams
 */

import type { StreamMessage } from "@lightfast/ai/v2/core";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { streamConsumer, streamGenerator } from "../config";

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
			await streamConsumer.consume(sessionId, controller.signal, {
				onMessage: async (message: StreamMessage) => {
					// Format the message for SSE based on type
					let data: any = {};

					switch (message.type) {
						case "chunk":
							data = { content: message.content };
							break;
						case "metadata":
							if ('status' in message && 'sessionId' in message && 'timestamp' in message) {
								data = { status: message.status, sessionId: message.sessionId, timestamp: message.timestamp };
							}
							break;
						case "event":
							if ('event' in message) {
								data = { event: message.event, data: 'data' in message ? message.data : undefined };
							}
							break;
						case "error":
							if ('error' in message) {
								data = { error: message.error, code: 'code' in message ? message.code : undefined };
							}
							break;
					}

					await stream.writeSSE({
						data: JSON.stringify(data),
						event: message.type,
						id: Date.now().toString(), // Generate ID since StreamMessage doesn't have one
					});
				},
				onError: async (error: Error) => {
					console.error(`Stream error for ${sessionId}:`, error);
					await stream.writeSSE({
						event: "error",
						data: JSON.stringify({
							error: error.message,
							timestamp: new Date().toISOString(),
						}),
					});
				},
				onComplete: async () => {
					await stream.writeSSE({
						event: "complete",
						data: JSON.stringify({
							message: "Stream completed",
							timestamp: new Date().toISOString(),
						}),
					});
				},
				lastEventId,
			});
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

// GET /stream/:sessionId/info - Get stream information
streamRoutes.get("/:sessionId/info", async (c) => {
	const sessionId = c.req.param("sessionId");

	try {
		const info = await streamGenerator.getStreamInfo(sessionId);

		return c.json(info);
	} catch (error) {
		console.error(`Failed to get stream info for ${sessionId}:`, error);
		return c.json(
			{
				error: "Failed to get stream info",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

export { streamRoutes };
