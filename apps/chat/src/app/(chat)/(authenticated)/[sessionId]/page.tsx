import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatInterface } from "~/components/chat/chat-interface";
import { PlanetScaleMemory } from "~/ai/runtime/memory/planetscale";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Server component - loads existing session
export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010";

	// Get userId - we need this for the ownership check
	const { userId } = await auth();
	if (!userId) {
		notFound();
	}

	// Create PlanetScale memory instance
	const memory = new PlanetScaleMemory();

	// Get session metadata
	const session = await memory.getSession(sessionId);

	// If session doesn't exist or user doesn't own it, return 404
	if (!session || session.resourceId !== userId) {
		notFound();
	}

	// Get messages for the session
	const messages = await memory.getMessages(sessionId);

	// Wrap in Suspense to ensure proper hydration timing
	return (
		<Suspense fallback={null}>
			<ChatInterface
				key={`${agentId}-${sessionId}`}
				agentId={agentId}
				sessionId={sessionId}
				initialMessages={messages}
			/>
		</Suspense>
	);
}

