"use client";

import { use } from "react";
import { SessionChatWrapper } from "./session-chat-wrapper";

interface SessionLoaderProps {
	params: Promise<{ sessionId: string }>;
	agentId: string;
}

// Client component that handles the async params
// This allows the layout to be synchronous and non-blocking
export function SessionLoader({ params, agentId }: SessionLoaderProps) {
	// use() hook handles the promise in a Suspense-compatible way
	const { sessionId } = use(params);
	
	return <SessionChatWrapper sessionId={sessionId} agentId={agentId} />;
}