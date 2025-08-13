import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { ChatLoadingSkeleton } from "../../_components/chat-loading-skeleton";
import { ExistingSessionChat } from "../_components/existing-session-chat";
import type React from "react";

interface SessionLayoutProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Layout for session pages - handles everything for the session
export default async function SessionLayout({ params }: SessionLayoutProps) {
	const { sessionId } = await params;
	const agentId = "c010"; // Default agent ID

	// Prefetch the session data here in layout
	// Layouts are preserved during navigation, reducing re-execution
	prefetch(trpc.chat.session.get.queryOptions({ sessionId }));

	// Render the entire chat interface in the layout
	// The page.tsx will be empty, making navigation instant
	return (
		<HydrateClient>
			<Suspense fallback={<ChatLoadingSkeleton />}>
				<ExistingSessionChat sessionId={sessionId} agentId={agentId} />
				{/* Children would go here but we don't need them */}
			</Suspense>
		</HydrateClient>
	);
}

