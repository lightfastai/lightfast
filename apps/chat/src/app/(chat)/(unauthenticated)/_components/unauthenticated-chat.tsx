import { Suspense } from "react";
import { ChatInterface } from "../../_components/chat-interface";
import { uuidv4 } from "@lightfast/core/v2/utils";

interface UnauthenticatedChatProps {
	agentId: string;
}

/**
 * Component for unauthenticated chat sessions.
 * Generates a server-side session ID and renders ChatInterface directly.
 * This provides consistency with the authenticated flow architecture.
 */
export function UnauthenticatedChat({ agentId }: UnauthenticatedChatProps) {
	// Generate a new session ID server-side
	const sessionId = uuidv4();

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