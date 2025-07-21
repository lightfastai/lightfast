import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatLayout } from "@/components/chat/chat-layout";
import { ChatSkeleton } from "@/components/chat/chat-skeleton";
import { experimentalAgents } from "@/mastra/agents/experimental";
import type { ExperimentalAgentId } from "@/mastra/agents/experimental/types";

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

	return (
		<ChatLayout>
			<Suspense fallback={<ChatSkeleton />}>
				<ChatInterface agentId={agentId} threadId={threadId} />
			</Suspense>
		</ChatLayout>
	);
}
