import { SessionChatWrapper } from "~/components/chat/session-chat-wrapper";
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

	return <SessionChatWrapper sessionId={sessionId} agentId={agentId} />;
}

