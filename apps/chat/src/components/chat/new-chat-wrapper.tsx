"use client";

import { useMemo } from "react";
import { AuthenticatedChatInterface } from "./authenticated-chat-interface";
import { uuidv4 } from "@lightfast/core/v2/utils";

interface NewChatWrapperProps {
	agentId: string;
}

/**
 * Client component wrapper for new chats that generates a stable session ID
 * This ensures the UUID is generated once on mount and remains stable across re-renders
 */
export function NewChatWrapper({ agentId }: NewChatWrapperProps) {
	// Generate session ID once on mount, stable across re-renders
	const clientSessionId = useMemo(() => uuidv4(), []);

	return (
		<AuthenticatedChatInterface 
			key={`${agentId}-${clientSessionId}`}
			agentId={agentId} 
			sessionId={clientSessionId} 
			initialMessages={[]} 
			isNewSession={true}
		/>
	);
}