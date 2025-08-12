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
 * URL will change to /chat/[agentId]/[sessionId] after first message
 */
export default async function NewChatPage({ params }: NewChatPageProps) {
	const { agentId } = await params;

	// Generate a new session ID server-side
	const sessionId = uuidv4();

	// Wrap in Suspense to ensure proper hydration timing
	return (
		<Suspense fallback={null}>
			<ChatInterface agentId={agentId} sessionId={sessionId} initialMessages={[]} />
		</Suspense>
	);
}
