import { Suspense } from "react";
import { ChatInterface } from "~/components/chat/chat-interface";
import { uuidv4 } from "@lightfast/core/v2/utils";

// Server component - generates sessionId server-side
export default function UnauthenticatedChatPage() {
	// Generate a new session ID server-side
	const sessionId = uuidv4();
	const agentId = "c010";

	// Wrap in Suspense to ensure proper hydration timing
	return (
		<Suspense fallback={null}>
			<ChatInterface 
				key={`${agentId}-${sessionId}`}
				agentId={agentId} 
				sessionId={sessionId} 
				initialMessages={[]}
				isAuthenticated={false}
				user={null}
			/>
		</Suspense>
	);
}