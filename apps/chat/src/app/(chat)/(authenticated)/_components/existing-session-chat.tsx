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
		// Session data rarely changes, cache for longer to enable instant navigation
		staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
		gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache even if inactive
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
		<ChatInterface
			key={`${agentId}-${sessionId}`}
			agentId={agentId}
			sessionId={sessionId}
			initialMessages={initialMessages}
			isNewSession={false}
			handleSessionCreation={handleSessionCreation}
			user={user}
			onFinish={() => {
				// Invalidate the session query to refresh from database
				// This ensures the cache is updated with the latest messages
				void queryClient.invalidateQueries({
					queryKey: [["chat", "session", "get"], { input: { sessionId }, type: "query" }],
				});
			}}
		/>
	);
}