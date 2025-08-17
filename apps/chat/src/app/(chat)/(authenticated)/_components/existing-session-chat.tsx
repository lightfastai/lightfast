"use client";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
export function ExistingSessionChat({ sessionId, agentId }: ExistingSessionChatProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	
	// Get user info - using suspense for instant loading
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
	});
	
	// Get session data - will use prefetched data if available
	const { data: sessionData, refetch } = useSuspenseQuery({
		...trpc.chat.session.get.queryOptions({ sessionId }),
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
		refetchOnWindowFocus: true, // Refetch when user returns to tab
		refetchOnMount: "always", // Always refetch when component mounts
	});
	
	// For sessions with no messages (likely new sessions with stale cache),
	// trigger an immediate refetch to get the latest data
	useEffect(() => {
		if (sessionData.messages.length === 0) {
			console.log(`[ExistingSessionChat] Empty messages detected for session ${sessionId}, refetching...`);
			refetch();
		}
	}, [sessionId, sessionData.messages.length, refetch]);

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
				onFinish={() => {
					// Don't invalidate here - it can cause race conditions
					// The messages are saved server-side, and will be fetched
					// fresh when the user navigates back due to staleTime: 0
				}}
			/>
		</>
	);
}