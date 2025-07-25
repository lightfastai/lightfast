import { auth } from "@clerk/nextjs/server";
import { Agent, type DatabaseOperations } from "@lightfast/ai/agent";
import type { LightfastUIMessage } from "@lightfast/types";
import {
	appendMessages,
	createMessages,
	createStream,
	createThread,
	getMessages,
	getThread,
	getThreadStreams,
} from "@/lib/db";
import { uuidv4 } from "@/lib/uuidv4";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string; threadId: string }> }) {
	try {
		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { agentId, threadId } = await params;
		const { messages }: { messages: LightfastUIMessage[] } = await request.json();

		// Create properly typed database operations object
		const dbOperations: DatabaseOperations<LightfastUIMessage> = {
			appendMessages,
			createMessages,
			createStream,
			createThread,
			getMessages,
			getThread,
			getThreadStreams,
		};

		// Create agent instance with enhanced configuration
		const agent = new Agent<LightfastUIMessage>({
			agentId,
			userId,
			db: dbOperations,
			generateId: uuidv4,
			// Enable reasoning for the experimental agent
			sendReasoning: true,
			sendSources: false,
		});

		// Stream the response
		return await agent.stream({ threadId, messages });
	} catch (error) {
		console.error("Error in POST /api/chat/[agentId]/[threadId]:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

export async function GET(_request: Request, { params }: { params: Promise<{ agentId: string; threadId: string }> }) {
	const { agentId, threadId } = await params;

	if (!threadId) {
		return new Response("threadId is required", { status: 400 });
	}

	// Check authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Create properly typed database operations object
	const dbOperations: DatabaseOperations<LightfastUIMessage> = {
		appendMessages,
		createMessages,
		createStream,
		createThread,
		getMessages,
		getThread,
		getThreadStreams,
	};

	// Create agent instance with consistent configuration
	const agent = new Agent<LightfastUIMessage>({
		agentId,
		userId,
		db: dbOperations,
		generateId: uuidv4,
	});

	try {
		const resumedStream = await agent.resumeStream(threadId);

		if (!resumedStream) {
			return new Response(null, { status: 204 });
		}

		return new Response(resumedStream);
	} catch (error) {
		if (error instanceof Error && error.message.includes("not found")) {
			return Response.json({ error: "Not found" }, { status: 404 });
		}
		throw error;
	}
}
