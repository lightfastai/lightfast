import { auth } from "@clerk/nextjs/server";
import { RedisMemory } from "@lightfast/ai/agent/memory/adapters/redis";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { env } from "@/env";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface ChatPageProps {
	params: Promise<{
		agentId: string;
		threadId: string;
	}>;
}

export default async function ChatPage({ params }: ChatPageProps) {
	const { agentId, threadId } = await params;

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

	// Get thread metadata
	const thread = await memory.getThread(threadId);

	// If thread doesn't exist or user doesn't own it, return 404
	if (!thread || thread.resourceId !== userId) {
		notFound();
	}

	// Get messages for the thread
	const messages = await memory.getMessages(threadId);

	console.log(messages.forEach((x) => console.log(x)));
	return (
		<Suspense fallback={null}>
			<ChatInterface agentId={agentId} threadId={threadId} initialMessages={messages} />
		</Suspense>
	);
}
