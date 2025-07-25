import { auth } from "@clerk/nextjs/server";
import type { LightfastUIMessage } from "@lightfast/types";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { getMessages, getThread } from "@/lib/db";

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

	// Get thread metadata
	const thread = await getThread(threadId);

	// If thread doesn't exist or user doesn't own it, return 404
	if (!thread || thread.userId !== userId) {
		notFound();
	}

	// Get messages for the thread
	const messages = await getMessages(threadId);

	return (
		<Suspense fallback={null}>
			<ChatInterface agentId={agentId} threadId={threadId} initialMessages={messages} />
		</Suspense>
	);
}
