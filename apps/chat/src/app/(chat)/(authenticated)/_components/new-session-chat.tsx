"use client";

import { ChatInterface } from "../../_components/chat-interface";
import { useCreateSession } from "~/hooks/use-create-session";
import { useSessionId } from "~/hooks/use-session-id";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { DataStreamProvider } from "~/hooks/use-data-stream";

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
		...trpc.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
		refetchOnMount: false, // Prevent blocking navigation
		refetchOnWindowFocus: false, // Don't refetch on window focus
	});

	// Model selection (authenticated users only have model selection)
	const { selectedModelId } = useModelSelection(true);

	// Hook for creating sessions optimistically
	const createSession = useCreateSession();

	// Get query client to optimistically update cache
	const queryClient = useQueryClient();

	// Get the query key for messages
	const messagesQueryKey = trpc.message.list.queryOptions({
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
		<DataStreamProvider>
			<ChatInterface
				agentId={agentId}
				sessionId={sessionId}
				initialMessages={[]}
				isNewSession={isNewSession}
				handleSessionCreation={handleSessionCreation}
				user={user}
				resume={false} // New sessions never have active streams to resume
				onNewUserMessage={(userMessage) => {
					// Optimistically append the user message to the cache
					queryClient.setQueryData(messagesQueryKey, (oldData) => {
						const currentMessages = oldData ?? [];
						// Check if message with this ID already exists
						if (currentMessages.some(msg => msg.id === userMessage.id)) {
							return currentMessages;
						}
						return [
							...currentMessages,
							{
								id: userMessage.id,
								role: userMessage.role,
								parts: userMessage.parts,
								modelId: selectedModelId,
							},
						];
					});
				}}
				onNewAssistantMessage={(assistantMessage) => {
					// Optimistically append the assistant message to the cache
					queryClient.setQueryData(messagesQueryKey, (oldData) => {
						const currentMessages = oldData ?? [];
						// Check if message with this ID already exists
						if (currentMessages.some(msg => msg.id === assistantMessage.id)) {
							return currentMessages;
						}
						return [
							...currentMessages,
							{
								id: assistantMessage.id,
								role: assistantMessage.role,
								parts: assistantMessage.parts,
								modelId: null,
							},
						];
					});

					// Also trigger a background refetch to ensure data consistency
					// This will update with the actual database data once it's persisted
					void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
				}}
			/>
		</DataStreamProvider>
	);
}
