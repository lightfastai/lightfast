import { auth } from "@clerk/nextjs/server";
import { RedisMemory } from "@lightfastai/core/memory/adapters/redis";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { env } from "@/env";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface ChatPageProps {
	params: Promise<{
		agentId: string;
		sessionId: string;
	}>;
}

export default async function ChatPage({ params }: ChatPageProps) {
	const { agentId, sessionId } = await params;

	// Get userId - we need this for the ownership check
	// Auth is already validated in parent layout, but we need the userId value
	const { userId } = await auth();
	if (!userId) {
		notFound();
	}

	// Create memory instance
	const memory = new RedisMemory<LightfastUIMessage>({
		url: env.KV_REST_API_URL,
		token: env.KV_REST_API_TOKEN,
	});

	// Get session metadata
	const session = await memory.getSession(sessionId);

	// If session doesn't exist or user doesn't own it, return 404
	if (!session || session.resourceId !== userId) {
		notFound();
	}

	// Get messages for the session
	const messages = await memory.getMessages(sessionId);

	console.log(messages.forEach((x) => console.log(x)));
	return (
		<Suspense fallback={null}>
			<ChatInterface agentId={agentId} sessionId={sessionId} initialMessages={messages} />
		</Suspense>
	);
}
