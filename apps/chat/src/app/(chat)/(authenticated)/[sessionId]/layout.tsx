import { Suspense } from "react";
import { HydrateClient } from "~/trpc/server";
import { ChatLoadingSkeleton } from "~/components/chat/chat-loading-skeleton";
import { SessionLoader } from "~/components/chat/session-loader";
import type React from "react";

interface SessionLayoutProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// SYNCHRONOUS layout - no async/await, no blocking on navigation
export default function SessionLayout({ params }: SessionLayoutProps) {
	const agentId = "c010"; // Default agent ID

	// No await, no prefetch - completely non-blocking
	// The SessionLoader client component handles the async params
	return (
		<HydrateClient>
			<Suspense fallback={<ChatLoadingSkeleton />}>
				<SessionLoader params={params} agentId={agentId} />
				{/* Children would go here but we don't need them */}
			</Suspense>
		</HydrateClient>
	);
}

