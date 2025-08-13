"use client";

import { useQuery } from "@tanstack/react-query";
import { AuthenticatedChatInterface } from "./authenticated-chat-interface";
import { ChatLoadingSkeleton } from "./chat-loading-skeleton";
import { useTRPC } from "~/trpc/react";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";

interface SessionChatWrapperProps {
	sessionId: string;
	agentId: string;
}

/**
 * Client component that fetches session data using useQuery
 * TEST: Using regular useQuery to avoid suspense and see loading behavior
 */
export function SessionChatWrapper({ sessionId, agentId }: SessionChatWrapperProps) {
	const trpc = useTRPC();
	
	// Use regular query - no suspense, manual loading state handling
	const { data, isLoading } = useQuery({
		...trpc.chat.session.get.queryOptions({ sessionId }),
		// Session data rarely changes, cache for longer to enable instant navigation
		staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
		gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache even if inactive
	});

	// Handle loading state manually
	if (isLoading || !data) {
		return <ChatLoadingSkeleton />;
	}

	// Convert database messages to UI format
	const initialMessages: LightfastAppChatUIMessage[] = data.messages.map((msg) => ({
		id: msg.id,
		role: msg.role,
		parts: msg.parts,
	})) as LightfastAppChatUIMessage[];

	return (
		<AuthenticatedChatInterface
			key={`${agentId}-${sessionId}`}
			agentId={agentId}
			sessionId={sessionId}
			initialMessages={initialMessages}
			isNewSession={false}
		/>
	);
}