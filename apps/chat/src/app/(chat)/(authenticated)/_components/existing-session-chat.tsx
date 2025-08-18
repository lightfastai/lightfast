"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { ChatInterface } from "../../_components/chat-interface";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "~/trpc/react";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";

interface ExistingSessionChatProps {
	sessionId: string;
	agentId: string;
}

/**
 * Client component that loads existing session data and renders the chat interface.
 * With prefetched data from the server, this should render instantly.
 */
export function ExistingSessionChat({
	sessionId,
	agentId,
}: ExistingSessionChatProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Get user info - using suspense for instant loading
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
	});

	// Model selection (authenticated users only have model selection)
	const { selectedModelId } = useModelSelection(true);

	// Get messages - will use prefetched data if available
	const messagesQueryOptions = trpc.chat.message.list.queryOptions({ sessionId });
	const { data: messages } = useSuspenseQuery({
		...messagesQueryOptions,
		staleTime: 30 * 1000, // Consider data fresh for 30 seconds (we update via callbacks)
		gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes for better navigation
		refetchOnWindowFocus: false, // Don't refetch on focus since we update optimistically
		refetchOnMount: true, // Only refetch if data is stale (respects staleTime)
	});

	// Convert database messages to UI format
	const initialMessages: LightfastAppChatUIMessage[] = messages.map(
		(msg) => ({
			id: msg.id,
			role: msg.role,
			parts: msg.parts,
		}),
	) as LightfastAppChatUIMessage[];

	// No-op for existing sessions - session already exists
	const handleSessionCreation = (_firstMessage: string) => {
		// Existing sessions don't need creation
	};

	return (
		<>
			<ChatInterface
				key={`${agentId}-${sessionId}-${initialMessages.length}`}
				agentId={agentId}
				sessionId={sessionId}
				initialMessages={initialMessages}
				isNewSession={false}
				handleSessionCreation={handleSessionCreation}
				user={user}
				onNewUserMessage={(userMessage) => {
					// Optimistically append the user message to the cache
					queryClient.setQueryData(messagesQueryOptions.queryKey, (oldData) => {
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
					queryClient.setQueryData(messagesQueryOptions.queryKey, (oldData) => {
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
					
					// Trigger a background refetch to sync with database
					// This ensures eventual consistency with the persisted data
					void queryClient.invalidateQueries({ queryKey: messagesQueryOptions.queryKey });
				}}
			/>
		</>
	);
}

