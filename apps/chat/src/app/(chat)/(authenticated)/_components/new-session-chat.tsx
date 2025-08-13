"use client";

import { useMemo } from "react";
import { uuidv4 } from "@repo/lib";
import { AuthenticatedChat } from "./authenticated-chat";

interface NewSessionChatProps {
	agentId: string;
}

/**
 * Component for creating new chat sessions.
 * Generates a client-side session ID once per component instance.
 */
export function NewSessionChat({ agentId }: NewSessionChatProps) {
	// Generate session ID once per component instance using useMemo
	// This ensures the ID remains stable during the component's lifecycle
	// but generates a fresh one if the component is unmounted and remounted
	// This prevents regenerating IDs on soft navigation (back button)
	const sessionId = useMemo(() => uuidv4(), []);

	return (
		<AuthenticatedChat
			agentId={agentId}
			sessionId={sessionId}
			initialMessages={[]}
			isNewSession={true}
		/>
	);
}

