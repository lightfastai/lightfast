"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { ChatInterface } from "../../_components/chat-interface";
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

	// Get messages - will use prefetched data if available
	const messagesQueryOptions = trpc.chat.message.list.queryOptions({ sessionId });
	const { data: messages } = useSuspenseQuery({
		...messagesQueryOptions,
		staleTime: 0, // Always consider data stale to ensure fresh fetches
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
		refetchOnWindowFocus: true, // Refetch when user returns to tab
		refetchOnMount: "always", // Always refetch when component mounts
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
	const handleSessionCreation = () => {
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
				onFinish={(assistantMessage, allMessages) => {
					// Optimistically update the cache with the complete messages
					// This ensures the cache is immediately updated with the new assistant message
					queryClient.setQueryData(messagesQueryOptions.queryKey, 
						// Simply return the updated messages array
						allMessages.map(msg => ({
							id: msg.id,
							role: msg.role,
							parts: msg.parts,
							modelId: null,
						}))
					);
					
					// Trigger a background refetch to sync with database
					// This ensures eventual consistency with the persisted data
					void queryClient.invalidateQueries({ queryKey: messagesQueryOptions.queryKey });
				}}
			/>
		</>
	);
}

