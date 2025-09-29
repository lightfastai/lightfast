import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "@repo/chat-trpc/server";
import { ChatLoadingSkeleton } from "../_components/chat-loading-skeleton";
import { ExistingSessionChat } from "../_components/existing-session-chat";
import { MESSAGE_INITIAL_CHAR_BUDGET } from "~/lib/messages/loading";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010"; // Default agent ID

	// Prefetch lightweight session metadata and the first message page for faster first paint.
	prefetch(trpc.session.getMetadata.queryOptions({ sessionId }));
	prefetch(
		trpc.message.listInfinite.infiniteQueryOptions({
			sessionId,
			limitChars: MESSAGE_INITIAL_CHAR_BUDGET,
		}),
	);

	return (
		<HydrateClient>
			<Suspense fallback={<ChatLoadingSkeleton />}>
				<ExistingSessionChat sessionId={sessionId} agentId={agentId} />
			</Suspense>
		</HydrateClient>
	);
}
