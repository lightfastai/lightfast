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
	// Returns a promise so the chat can wait for session creation
	const handleSessionCreation = async () => {
		if (isNewSession) {
			// Update the URL immediately for instant feedback
			window.history.replaceState({}, "", `/${sessionId}`);

			// Create the session and wait for it to complete
			// This ensures the session exists before sending the first message
			try {
				await createSession.mutateAsync({ id: sessionId });
			} catch (error) {
				// Session creation failed, but we can still proceed
				// The unique constraint will prevent duplicates
				console.warn("Session creation failed, proceeding anyway:", error);
			}
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