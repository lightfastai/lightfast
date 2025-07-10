import type { NextRequest } from "next/server";
import { sseManager } from "@/lib/mastra/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { chatId: string } }) {
	const { chatId } = params;

	// Create a readable stream for SSE
	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection message
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", chatId })}\n\n`));

			// Add client to SSE manager
			const cleanup = sseManager.addClient(chatId, (data) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			});

			// Handle client disconnect
			request.signal.addEventListener("abort", () => {
				cleanup();
				controller.close();
			});
		},
	});

	// Return SSE response
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no", // Disable Nginx buffering
		},
	});
}
