"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { ChatInterface } from "../../_components/chat-interface";
import { useTRPC } from "~/trpc/react";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { ErrorTestPanel } from "~/components/dev/error-test-panel";

interface ExistingSessionChatProps {
	sessionId: string;
	agentId: string;
}

/**
 * Client component that loads existing session data and renders the chat interface.
 * With prefetched data from the server, this should render instantly.
 */
export function ExistingSessionChat({ sessionId, agentId }: ExistingSessionChatProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	
	// Get user info - using suspense for instant loading
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
	});
	
	// Get session data - will use prefetched data if available
	const { data: sessionData } = useSuspenseQuery({
		...trpc.chat.session.get.queryOptions({ sessionId }),
		// Reduced cache times to ensure data freshness after updates
		staleTime: 10 * 1000, // 10 seconds - data considered fresh
		gcTime: 60 * 1000, // 1 minute - keep in cache when inactive
		refetchOnWindowFocus: true, // Refetch when user returns to tab
		refetchOnMount: "always", // Always refetch when component mounts
	});

	// Convert database messages to UI format
	const initialMessages: LightfastAppChatUIMessage[] = sessionData.messages.map((msg) => ({
		id: msg.id,
		role: msg.role,
		parts: msg.parts,
	})) as LightfastAppChatUIMessage[];

	// No-op for existing sessions - session already exists
	const handleSessionCreation = () => {
		// Existing sessions don't need creation
	};

	return (
		<>
			<ChatInterface
				key={`${agentId}-${sessionId}`}
				agentId={agentId}
				sessionId={sessionId}
				initialMessages={initialMessages}
				isNewSession={false}
				handleSessionCreation={handleSessionCreation}
				user={user}
				onFinish={async () => {
					// Invalidate the session query to refresh from database
					// This ensures the cache is updated with the latest messages
					await queryClient.invalidateQueries({
						queryKey: trpc.chat.session.get.queryOptions({ sessionId }).queryKey,
					});
					
					// Also refetch the query immediately to ensure fresh data
					// This is important for when users navigate away and back
					await queryClient.refetchQueries({
						queryKey: trpc.chat.session.get.queryOptions({ sessionId }).queryKey,
					});
				}}
			/>
			<ErrorTestPanel />
		</>
	);
}