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
		// Use very short stale time to ensure fresh data
		// The prefetch from the layout will populate initial data
		// but we'll refetch in background to get any updates
		staleTime: 0, // Always considered stale, will refetch in background
		gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes for instant navigation
		refetchOnWindowFocus: true, // Refetch when user returns to tab
		refetchOnMount: "always", // Always refetch when component mounts
		refetchInterval: false, // No polling
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
				onFinish={() => {
					// Don't invalidate here - it can cause race conditions
					// The messages are saved server-side, and will be fetched
					// fresh when the user navigates back due to staleTime: 0
				}}
			/>
		</>
	);
}