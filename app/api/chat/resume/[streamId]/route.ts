import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getStreamContext } from "@/lib/resumable-stream-context";

export async function GET(request: NextRequest, { params }: { params: Promise<{ streamId: string }> }) {
	try {
		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { streamId } = await params;

		// Get resumable stream context
		const streamContext = getStreamContext();

		if (!streamContext) {
			return Response.json({ error: "Resumable streams are not configured" }, { status: 503 });
		}

		// Resume the stream using the resumeExistingStream method
		const resumedStream = await streamContext.resumeExistingStream(streamId);

		if (resumedStream === undefined) {
			return Response.json({ error: "Stream not found" }, { status: 404 });
		}

		if (resumedStream === null) {
			return Response.json(
				{ error: "Stream has already completed" },
				{ status: 410 }, // Gone
			);
		}

		// Convert string stream to byte stream for Response
		const byteStream = resumedStream.pipeThrough(new TextEncoderStream());

		return new Response(byteStream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"X-Stream-Id": streamId,
			},
		});
	} catch (error) {
		console.error("Resume stream error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
