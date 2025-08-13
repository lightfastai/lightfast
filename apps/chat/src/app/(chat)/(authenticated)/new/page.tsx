import { Suspense } from "react";
import { randomUUID } from "crypto";
import { AuthenticatedChatInterface } from "~/components/chat/authenticated-chat-interface";
import { HydrateClient } from "~/trpc/server";

// Server component for new chats
export default function NewChatPage() {
	const agentId = "c010";

	// Generate session ID server-side - ensures a fresh ID on each navigation
	const sessionId = randomUUID();

	// Wrap in HydrateClient to enable instant hydration of prefetched data
	// User data is already prefetched in the layout
	return (
		<HydrateClient>
			<Suspense fallback={null}>
				<AuthenticatedChatInterface
					agentId={agentId}
					sessionId={sessionId}
					initialMessages={[]}
					isNewSession={true}
				/>
			</Suspense>
		</HydrateClient>
	);
}

