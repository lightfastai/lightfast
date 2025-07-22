import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { checkThreadOwnership, getThreadMessages } from "@/app/actions/thread";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatLayout } from "@/components/chat/chat-layout";
import { ChatSkeleton } from "@/components/chat/chat-skeleton";
import { experimentalAgents } from "@/mastra/agents/experimental";
import type { ExperimentalAgentId } from "@/mastra/agents/experimental/types";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

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

	// Validate agentId on the server
	if (!experimentalAgents[agentId as ExperimentalAgentId]) {
		notFound();
	}

	// Check thread ownership using mastra.memory
	const { exists, isOwner } = await checkThreadOwnership(threadId, userId, agentId);

	if (!exists || !isOwner) {
		notFound();
	}

	// Fetch all thread messages
	const { uiMessages } = await getThreadMessages(threadId, agentId);

	console.log(uiMessages);
	return (
		<ChatLayout agentId={agentId}>
			<Suspense fallback={<ChatSkeleton />}>
				<ChatInterface agentId={agentId} threadId={threadId} initialMessages={uiMessages as LightfastUIMessage[]} />
			</Suspense>
		</ChatLayout>
	);
}
