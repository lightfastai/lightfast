import { SessionChatWrapper } from "~/components/chat/session-chat-wrapper";
import { HydrateClient } from "~/trpc/server";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Server component - renders the chat interface
export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010";

	// TEST: No prefetch, no Suspense - let useQuery handle everything
	// This should eliminate any server-side blocking
	return (
		<HydrateClient>
			<SessionChatWrapper sessionId={sessionId} agentId={agentId} />
		</HydrateClient>
	);
}
