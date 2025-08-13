"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { AuthenticatedChat } from "./authenticated-chat";
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
	
	// Use suspense query - will use prefetched data if available
	const { data } = useSuspenseQuery({
		...trpc.chat.session.get.queryOptions({ sessionId }),
		// Session data rarely changes, cache for longer to enable instant navigation
		staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
		gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache even if inactive
	});

	// Convert database messages to UI format
	const initialMessages: LightfastAppChatUIMessage[] = data.messages.map((msg) => ({
		id: msg.id,
		role: msg.role,
		parts: msg.parts,
	})) as LightfastAppChatUIMessage[];

	return (
		<AuthenticatedChat
			key={`${agentId}-${sessionId}`}
			agentId={agentId}
			sessionId={sessionId}
			initialMessages={initialMessages}
			isNewSession={false}
		/>
	);
}