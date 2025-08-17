import { Suspense } from "react";
import { NewSessionChat } from "../_components/new-session-chat";
import { HydrateClient } from "~/trpc/server";
import { ChatLoadingSkeleton } from "../_components/chat-loading-skeleton";

export default function NewChatPage() {
	const agentId = "c010";
	
	// Wrap in HydrateClient to enable instant hydration of prefetched data
	// User data is already prefetched in the authenticated layout
	// Session ID is generated client-side in NewSessionChat
	return (
		<HydrateClient>
			<Suspense fallback={<ChatLoadingSkeleton />}>
				<NewSessionChat agentId={agentId} />
			</Suspense>
		</HydrateClient>
	);
}