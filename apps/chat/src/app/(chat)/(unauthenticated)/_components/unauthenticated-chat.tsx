"use client";

import { useRef } from "react";
import { ChatInterface } from "../../_components/chat-interface";
import { DataStreamProvider } from "~/hooks/use-data-stream";
import { uuidv4 } from "lightfast/v2/utils";

interface UnauthenticatedChatProps {
	agentId: string;
}

/**
 * Component for unauthenticated chat sessions.
 * Generates a stable client-side session ID and renders ChatInterface directly.
 * This provides consistency with the authenticated flow architecture.
 */
export function UnauthenticatedChat({ agentId }: UnauthenticatedChatProps) {
	// Use useRef to generate a stable ID that persists across renders
	const sessionIdRef = useRef<string | null>(null);
	
	// Generate ID only once, on first render
	sessionIdRef.current ??= uuidv4();

	// No-op function for session creation (not needed for unauthenticated users)
	const handleSessionCreation = (_firstMessage: string) => {
		// Unauthenticated users don't have persistent sessions
		// This is a no-op handler to satisfy the interface
	};

	return (
		<DataStreamProvider>
			<ChatInterface 
				key={`${agentId}-${sessionIdRef.current}`}
				agentId={agentId} 
				sessionId={sessionIdRef.current} 
				initialMessages={[]}
				isNewSession={false} // Unauthenticated sessions are not persisted
				handleSessionCreation={handleSessionCreation}
				user={null}
				resume={false} // Unauthenticated sessions don't persist streams
			/>
		</DataStreamProvider>
	);
}