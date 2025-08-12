import { auth } from "@clerk/nextjs/server";
import { MessageReader } from "@lightfast/core/v2/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { redis } from "@/app/(v2)/ai/config";
import { ChatInterface } from "@/components/v2/chat-interface-refactored";

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

	// Create message reader instance
	const messageReader = new MessageReader(redis);

	// Get messages for the session
	const messages = await messageReader.getMessages(sessionId);

	// If no messages exist, this might be an invalid session
	// In v2, we don't have session metadata yet, so we just check if messages exist
	// TODO: Add session metadata support in v2
	if (!messages || messages.length === 0) {
		// For now, allow empty sessions (new conversations)
		// notFound();
	}

	console.log(messages);

	return (
		<Suspense fallback={null}>
			<ChatInterface agentId={agentId} sessionId={sessionId} initialMessages={messages} />
		</Suspense>
	);
}
