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
 * 3. handleSessionCreation() is called -> Navigate to /{sessionId} via Next.js router
 * 4. Proper navigation ensures page component executes and data is prefetched
 * 5. If user hits back button to /new, a new ID is generated
 */
export function NewSessionChat({ agentId }: NewSessionChatProps) {
	// Use the hook to manage session ID generation and navigation state
	const { sessionId, isNewSession } = useSessionId();

	// Get user info - using suspense for instant loading
	const trpc = useTRPC();
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
	});

	// Hook for creating sessions optimistically
	const createSession = useCreateSession();

	// Get query client to optimistically update cache
	const queryClient = useQueryClient();

	// Get the query key for messages
	const messagesQueryKey = trpc.chat.message.list.queryOptions({
		sessionId,
	}).queryKey;

	// Handle session creation when the first message is sent
	const handleSessionCreation = (firstMessage: string) => {
		if (!isNewSession) {
			// Already transitioned to /{sessionId}, no need to create
			return;
		}

		// Update the URL immediately for instant feedback
		window.history.replaceState({}, "", `/${sessionId}`);

		// Create the session optimistically (fire-and-forget)
		// The backend will also create it if needed (upsert behavior)
		// This ensures instant UI updates without blocking message sending
		createSession.mutate({ id: sessionId, firstMessage });
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
				onFinish={(assistantMessage, allMessages) => {
					// Optimistically update the cache with the complete messages
					// This prevents stale state issues when navigating
					queryClient.setQueryData(
						messagesQueryKey,
						// Simply set the messages array
						allMessages.map((msg) => ({
							id: msg.id,
							role: msg.role,
							parts: msg.parts,
							modelId: null,
						})),
					);

					// Also trigger a background refetch to ensure data consistency
					// This will update with the actual database data once it's persisted
					void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
				}}
			/>
		</>
	);
}
