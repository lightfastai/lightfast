import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { checkThreadOwnership, getThreadMessages } from "@/app/actions/thread";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatLayout } from "@/components/chat/chat-layout";
import { ChatSkeleton } from "@/components/chat/chat-skeleton";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DataStreamProvider } from "@/components/data-stream-provider";
import type { ExperimentalAgentId } from "@lightfast/types";
import type { LightfastUIMessage } from "@lightfast/types";

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
		<DataStreamProvider>
			<ChatLayout agentId={agentId}>
				<Suspense fallback={<ChatSkeleton />}>
					<ChatInterface agentId={agentId} threadId={threadId} initialMessages={uiMessages as LightfastUIMessage[]} />
				</Suspense>
				<DataStreamHandler />
			</ChatLayout>
		</DataStreamProvider>
	);
}
