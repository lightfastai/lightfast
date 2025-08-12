import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatInterface } from "~/components/chat/chat-interface";
import { PlanetScaleMemory } from "~/ai/runtime/memory/planetscale";
import { ChatLoadingSkeleton } from "~/components/chat/chat-loading-skeleton";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Async component that does the data fetching
async function SessionChatInterface({ sessionId, agentId }: { sessionId: string; agentId: string }) {
	// Get userId - we need this for the ownership check
	const { userId } = await auth();
	if (!userId) {
		notFound();
	}

	// Create PlanetScale memory instance
	const memory = new PlanetScaleMemory();

	// Get session metadata - sessionId here is the clientSessionId from the URL
	const session = await memory.getSession(sessionId);

	// If session doesn't exist or user doesn't own it, return 404
	if (!session || session.resourceId !== userId) {
		notFound();
	}

	// Get messages for the session using the clientSessionId
	const messages = await memory.getMessages(sessionId);

	return (
		<ChatInterface
			key={`${agentId}-${sessionId}`}
			agentId={agentId}
			sessionId={sessionId}  // Use clientSessionId consistently
			initialMessages={messages}
			isNewSession={false}
		/>
	);
}

// Server component - immediately returns with Suspense boundary
export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010";

	// Return immediately with Suspense boundary
	// This prevents blocking during navigation
	return (
		<Suspense fallback={<ChatLoadingSkeleton />}>
			<SessionChatInterface sessionId={sessionId} agentId={agentId} />
		</Suspense>
	);
}

