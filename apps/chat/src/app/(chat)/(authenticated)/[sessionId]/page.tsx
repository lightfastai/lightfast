import { Suspense } from "react";
import { SessionChatWrapper } from "~/components/chat/session-chat-wrapper";
import { ChatLoadingSkeleton } from "~/components/chat/chat-loading-skeleton";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Server component - renders the chat interface
export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010";

	// Session data is prefetched in layout.tsx
	// Render the chat interface with Suspense
	return (
		<Suspense fallback={<ChatLoadingSkeleton />}>
			<SessionChatWrapper sessionId={sessionId} agentId={agentId} />
		</Suspense>
	);
}
