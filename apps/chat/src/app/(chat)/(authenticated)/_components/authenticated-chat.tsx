"use client";

import { ChatInterface } from "../../_components/chat-interface";
import { useCreateSession } from "~/hooks/use-create-session";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

interface AuthenticatedChatProps {
	agentId: string;
	sessionId: string;
	initialMessages?: LightfastAppChatUIMessage[];
	isNewSession?: boolean;
}

/**
 * Authenticated chat component that fetches user data and handles session creation.
 * Wraps the base ChatInterface with authentication context.
 */
export function AuthenticatedChat({
	agentId,
	sessionId,
	initialMessages = [],
	isNewSession = false,
}: AuthenticatedChatProps) {
	// Get user info from tRPC - using suspense for instant loading
	const trpc = useTRPC();
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
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