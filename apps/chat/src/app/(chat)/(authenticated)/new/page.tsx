import { Suspense } from "react";
import { NewSessionChat } from "../_components/new-session-chat";
import { HydrateClient } from "~/trpc/server";

// Server component for new chats
export default function NewChatPage() {
	const agentId = "c010";

	// Wrap in HydrateClient to enable instant hydration of prefetched data
	// User data is already prefetched in the layout
	// Session ID is now generated client-side in NewChatWrapper
	return (
		<HydrateClient>
			<Suspense fallback={null}>
				<NewSessionChat agentId={agentId} />
			</Suspense>
		</HydrateClient>
	);
}

