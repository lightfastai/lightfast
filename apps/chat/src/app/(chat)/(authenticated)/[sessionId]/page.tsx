import { Suspense } from "react";
import { SessionChatWrapper } from "~/components/chat/session-chat-wrapper";
import { ChatLoadingSkeleton } from "~/components/chat/chat-loading-skeleton";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Server component - renders the chat interface
export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010";

	// Use the custom prefetch function (no await, no blocking)
	// This fires off the query and adds to cache without waiting
	prefetch(trpc.chat.session.get.queryOptions({ sessionId }));

	// Wrap in HydrateClient to ensure the prefetched data is included in hydration
	// This makes the data instantly available to SessionChatWrapper
	return (
		<HydrateClient>
			<Suspense fallback={<ChatLoadingSkeleton />}>
				<SessionChatWrapper sessionId={sessionId} agentId={agentId} />
			</Suspense>
		</HydrateClient>
	);
}
