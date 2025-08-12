"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ChatInterface } from "./chat-interface";
import { useTRPC } from "~/trpc/react";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";

interface SessionChatWrapperProps {
	sessionId: string;
	agentId: string;
}

/**
 * Client component that fetches session data using useSuspenseQuery
 * This enables instant navigation when data is cached
 */
export function SessionChatWrapper({ sessionId, agentId }: SessionChatWrapperProps) {
	const trpc = useTRPC();
	
	// Use suspense query with TRPC query options - will suspend if not cached, return instantly if cached
	const { data } = useSuspenseQuery({
		...trpc.chat.session.get.queryOptions({ sessionId }),
	});

	// Note: useSuspenseQuery guarantees data is available
	// If session doesn't exist, tRPC will throw NOT_FOUND error

	// Convert database messages to UI format
	const initialMessages: LightfastAppChatUIMessage[] = data.messages.map((msg) => ({
		id: msg.id,
		role: msg.role,
		parts: msg.parts,
	}));

	return (
		<ChatInterface
			key={`${agentId}-${sessionId}`}
			agentId={agentId}
			sessionId={sessionId}
			initialMessages={initialMessages}
			isNewSession={false}
		/>
	);
}