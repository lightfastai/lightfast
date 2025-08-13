"use client";

import { ChatInterface } from "./chat-interface";
import { useCreateSession } from "~/hooks/use-create-session";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

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
	// Get user info from tRPC
	const trpc = useTRPC();
	const { data: user } = useQuery({
		...trpc.auth.user.getUser.queryOptions(),
	});

	// Hook for creating sessions optimistically - only in authenticated context
	const createSession = useCreateSession();

	// Handle session creation for authenticated users
	const handleSessionCreation = () => {
		if (isNewSession) {
			// Update the URL immediately for instant feedback
			window.history.replaceState({}, "", `/${sessionId}`);

			// Create the session optimistically (fire-and-forget)
			// The backend will also create it if needed (upsert behavior)
			// This ensures instant UI updates without blocking message sending
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
			isAuthenticated={true}
			user={user}
		/>
	);
}