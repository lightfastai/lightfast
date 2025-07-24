import { auth } from "@clerk/nextjs/server";
import type { ExperimentalAgentId, LightfastUIMessage } from "@lightfast/types";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getThreadDataWithOwnership } from "@/app/actions/thread";
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

	// Use the optimized server action that combines ownership check and message fetching
	const { exists, isOwner, uiMessages } = await getThreadDataWithOwnership(threadId, userId, agentId);

	if (!exists || !isOwner) {
		notFound();
	}

	return (
		<Suspense fallback={null}>
			<ChatInterface agentId={agentId} threadId={threadId} initialMessages={uiMessages as LightfastUIMessage[]} />
		</Suspense>
	);
}
