"use client";

import { ChatInterface } from "./chat-interface";
import { useCreateSession } from "~/hooks/use-create-session";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";

interface AuthenticatedChatInterfaceProps {
	agentId: string;
	sessionId: string;
	initialMessages?: LightfastAppChatUIMessage[];
	isNewSession?: boolean;
}

export function AuthenticatedChatInterface({
	agentId,
	sessionId,
	initialMessages = [],
	isNewSession = false,
}: AuthenticatedChatInterfaceProps) {
	// Hook for creating sessions optimistically - only in authenticated context
	const createSession = useCreateSession();

	// Handle session creation for authenticated users
	const handleSessionCreation = () => {
		if (isNewSession) {
			// Update the URL immediately for instant feedback
			window.history.replaceState({}, "", `/${sessionId}`);

			// Create the session using mutate (fire and forget)
			// The mutation has optimistic updates so UI will update immediately
			// The unique constraint in the database will prevent duplicate sessions
			createSession.mutate({ id: sessionId });
		} else {
			// For existing sessions, just update the URL to ensure consistency
			window.history.replaceState({}, "", `/${sessionId}`);
		}
	};

	return (
		<ChatInterface
			agentId={agentId}
			sessionId={sessionId}
			initialMessages={initialMessages}
			isNewSession={isNewSession}
			onFirstMessage={handleSessionCreation}
		/>
	);
}