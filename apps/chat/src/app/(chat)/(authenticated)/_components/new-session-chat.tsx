"use client";

import { ChatInterface } from "../../_components/chat-interface";
import { useCreateSession } from "~/hooks/use-create-session";
import { useSessionId } from "~/hooks/use-session-id";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";

interface NewSessionChatProps {
	agentId: string;
}

/**
 * Component for creating new chat sessions.
 * Uses useSessionId hook to manage session ID generation and navigation.
 *
 * Flow:
 * 1. User visits /new -> Hook generates a fresh session ID
 * 2. User types and sends first message
 * 3. handleSessionCreation() is called -> URL changes to /{sessionId} via replaceState
 * 4. Component re-renders, hook extracts ID from URL
 * 5. If user hits back button to /new, a new ID is generated
 */
export function NewSessionChat({ agentId }: NewSessionChatProps) {
	// Use the hook to manage session ID generation and navigation state
	const { sessionId, isNewSession } = useSessionId();

	// Get user info - using suspense for instant loading
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
	});

	// Hook for creating sessions optimistically
	const createSession = useCreateSession();

	// Handle session creation when the first message is sent
	const handleSessionCreation = () => {
		if (!isNewSession) {
			// Already transitioned to /{sessionId}, no need to create
			return;
		}

		// Update the URL immediately for instant feedback
		window.history.replaceState({}, "", `/${sessionId}`);

		// Create the session optimistically (fire-and-forget)
		// The backend will also create it if needed (upsert behavior)
		// This ensures instant UI updates without blocking message sending
		createSession.mutate({ id: sessionId });
	};

	return (
		<>
			<ChatInterface
				agentId={agentId}
				sessionId={sessionId}
				initialMessages={[]}
				isNewSession={isNewSession}
				handleSessionCreation={handleSessionCreation}
				user={user}
				onFinish={async () => {
					// Invalidate the session query to ensure cache is populated
					// This is important for new sessions that didn't exist in cache before
					await queryClient.invalidateQueries({
						queryKey: trpc.chat.session.get.queryOptions({ sessionId }).queryKey,
					});
					
					// Also refetch the query immediately to ensure fresh data
					await queryClient.refetchQueries({
						queryKey: trpc.chat.session.get.queryOptions({ sessionId }).queryKey,
					});
				}}
			/>
		</>
	);
}
