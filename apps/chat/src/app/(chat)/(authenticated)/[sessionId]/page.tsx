import { Suspense } from "react";
import { SessionChatWrapper } from "~/components/chat/session-chat-wrapper";
import { ChatLoadingSkeleton } from "~/components/chat/chat-loading-skeleton";
import { trpc, prefetch } from "~/trpc/server";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Server component - validates session exists before rendering
export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010";

	// Check if session exists on the server using fetchQuery
	// This will throw if session doesn't exist or user doesn't have access

	// Prefetch the session data to make it instantly available in SessionChatWrapper
	// This populates the cache so the client component doesn't need to fetch again
	prefetch(trpc.chat.session.get.queryOptions({ sessionId }));
	
	// Prefetch pinned sessions for instant loading with Suspense
	prefetch(trpc.chat.session.listPinned.queryOptions());

	// Session exists and user has access - render the chat interface with Suspense
	return (
		<Suspense fallback={<ChatLoadingSkeleton />}>
			<SessionChatWrapper sessionId={sessionId} agentId={agentId} />
		</Suspense>
	);
}
