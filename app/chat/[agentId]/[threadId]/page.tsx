import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getThreadMessages } from "@/app/actions/thread";
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

	// Validate agentId on the server
	if (!experimentalAgents[agentId as ExperimentalAgentId]) {
		notFound();
	}

	// Fetch thread messages
	const { uiMessages } = await getThreadMessages(threadId, agentId);

	return (
		<ChatLayout agentId={agentId}>
			<Suspense fallback={<ChatSkeleton />}>
				<ChatInterface agentId={agentId} threadId={threadId} initialMessages={uiMessages as LightfastUIMessage[]} />
			</Suspense>
		</ChatLayout>
	);
}
