import { auth } from "@clerk/nextjs/server";
import type { ExperimentalAgentId, LightfastUIMessage } from "@lightfast/types";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { checkThreadOwnership, getThreadMessages } from "@/app/actions/thread";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatLayout } from "@/components/chat/chat-layout";
import { ChatSkeleton } from "@/components/chat/chat-skeleton";

interface ChatPageProps {
	params: Promise<{
		agentId: ExperimentalAgentId;
		threadId: string;
	}>;
}

export default async function ChatPage({ params }: ChatPageProps) {
	const { agentId, threadId } = await params;

	// Get current user
	const { userId } = await auth();
	if (!userId) {
		notFound();
	}

	// Validate agentId is a valid type
	const validAgentIds: ExperimentalAgentId[] = ["a010", "a011"];
	if (!validAgentIds.includes(agentId)) {
		notFound();
	}

	// Check thread ownership using mastra.memory
	const { exists, isOwner } = await checkThreadOwnership(threadId, userId, agentId);

	if (!exists || !isOwner) {
		notFound();
	}

	// Fetch all thread messages
	const { uiMessages } = await getThreadMessages(threadId, agentId);

	return (
		<ChatLayout agentId={agentId}>
			<Suspense fallback={<ChatSkeleton />}>
				<ChatInterface agentId={agentId} threadId={threadId} initialMessages={uiMessages as LightfastUIMessage[]} />
			</Suspense>
		</ChatLayout>
	);
}
