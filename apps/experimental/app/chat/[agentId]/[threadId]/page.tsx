import { auth } from "@clerk/nextjs/server";
import type { ExperimentalAgentId, LightfastUIMessage } from "@lightfast/types";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getThread, getMessages, convertToLightfastMessages } from "@/lib/db";
import { ChatInterface } from "@/components/chat/chat-interface";

interface ChatPageProps {
	params: Promise<{
		agentId: ExperimentalAgentId;
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
	const uiMessages = convertToLightfastMessages(messages);

	return (
		<Suspense fallback={null}>
			<ChatInterface agentId={agentId} threadId={threadId} userId={userId} initialMessages={uiMessages as LightfastUIMessage[]} />
		</Suspense>
	);
}
