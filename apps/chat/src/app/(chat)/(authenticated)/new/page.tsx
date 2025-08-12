import { Suspense } from "react";
import { AuthenticatedChatInterface } from "~/components/chat/authenticated-chat-interface";
import { uuidv4 } from "@lightfast/core/v2/utils";
import { prefetch, trpc } from "~/trpc/server";

// Server component for new chats
export default function NewChatPage() {
	const agentId = "c010";
	// Generate a client session ID server-side
	const clientSessionId = uuidv4();
	
	// Prefetch pinned sessions for instant loading with Suspense
	prefetch(trpc.chat.session.listPinned.queryOptions());

	// Wrap in Suspense to ensure proper hydration timing
	return (
		<Suspense fallback={null}>
			<AuthenticatedChatInterface 
				key={`${agentId}-${clientSessionId}`}
				agentId={agentId} 
				sessionId={clientSessionId} 
				initialMessages={[]} 
				isNewSession={true}
			/>
		</Suspense>
	);
}