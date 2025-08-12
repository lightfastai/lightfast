import { Suspense } from "react";
import { randomUUID } from "crypto";
import { AuthenticatedChatInterface } from "~/components/chat/authenticated-chat-interface";

// Server component for new chats
export default function NewChatPage() {
	const agentId = "c010";

	// Generate session ID server-side - ensures a fresh ID on each navigation
	const sessionId = randomUUID();

	return (
		<Suspense fallback={null}>
			<AuthenticatedChatInterface
				agentId={agentId}
				sessionId={sessionId}
				initialMessages={[]}
				isNewSession={true}
			/>
		</Suspense>
	);
}

