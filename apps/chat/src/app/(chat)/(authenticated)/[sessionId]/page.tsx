import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "@repo/chat-trpc/server";
import { ChatLoadingSkeleton } from "../_components/chat-loading-skeleton";
import { ExistingSessionChat } from "../_components/existing-session-chat";
import { MESSAGE_HEAD_LIMIT } from "~/lib/messages/loading";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010"; // Default agent ID

	// Prefetch lightweight session metadata and the most recent messages for faster first paint.
	prefetch(trpc.session.getMetadata.queryOptions({ sessionId }));
	prefetch(
		trpc.message.listHead.queryOptions({
			sessionId,
			limit: MESSAGE_HEAD_LIMIT,
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
