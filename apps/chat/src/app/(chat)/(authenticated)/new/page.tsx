import { Suspense } from "react";
import { ChatInterface } from "~/components/chat/chat-interface";
import { uuidv4 } from "@lightfast/core/v2/utils";

// Server component for new chats
export default function NewChatPage() {
	const agentId = "c010";
	// Generate a client session ID server-side
	const clientSessionId = uuidv4();

	// Wrap in Suspense to ensure proper hydration timing
	return (
		<Suspense fallback={null}>
			<ChatInterface 
				key={`${agentId}-${clientSessionId}`}
				agentId={agentId} 
				sessionId={clientSessionId} 
				initialMessages={[]} 
				isNewSession={true}
			/>
		</Suspense>
	);
}