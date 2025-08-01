import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { uuidv4 } from "@/lib/uuidv4";

interface NewChatPageProps {
	params: Promise<{
		agentId: string;
	}>;
}

/**
 * New chat page at /chat/[agentId]
 * Generates UUID server-side and renders chat interface
 * URL will change to /chat/[agentId]/[threadId] after first message
 */
export default async function NewChatPage({ params }: NewChatPageProps) {
	const { agentId } = await params;

	// Generate a new thread ID server-side
	const threadId = uuidv4();

	// Wrap in Suspense to ensure proper hydration timing
	return (
		<Suspense fallback={null}>
			<ChatInterface agentId={agentId} threadId={threadId} initialMessages={[]} />
		</Suspense>
	);
}
