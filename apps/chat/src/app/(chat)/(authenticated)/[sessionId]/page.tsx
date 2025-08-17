import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { ChatLoadingSkeleton } from "../_components/chat-loading-skeleton";
import { ExistingSessionChat } from "../_components/existing-session-chat";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010"; // Default agent ID

	// Prefetch the session data here in the page
	// Pages re-execute on navigation, ensuring fresh data
	prefetch(trpc.chat.session.get.queryOptions({ sessionId }));

	return (
		<HydrateClient>
			<Suspense fallback={<ChatLoadingSkeleton />}>
				<ExistingSessionChat sessionId={sessionId} agentId={agentId} />
			</Suspense>
		</HydrateClient>
	);
}
