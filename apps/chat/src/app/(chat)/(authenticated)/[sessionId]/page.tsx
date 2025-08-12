import { Suspense } from "react";
import { SessionChatWrapper } from "~/components/chat/session-chat-wrapper";
import { ChatLoadingSkeleton } from "~/components/chat/chat-loading-skeleton";
import { prefetch, trpc } from "~/trpc/server";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Server component - prefetches data then returns with Suspense boundary
export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010";

	// Prefetch session data on the server
	// This will make it instantly available in SessionChatWrapper
	prefetch(trpc.chat.session.get.queryOptions({ sessionId }));

	// Return immediately with Suspense boundary
	// SessionChatWrapper will use useSuspenseQuery for instant cached data
	return (
		<Suspense fallback={<ChatLoadingSkeleton />}>
			<SessionChatWrapper sessionId={sessionId} agentId={agentId} />
		</Suspense>
	);
}

