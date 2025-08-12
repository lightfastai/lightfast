import { Suspense } from "react";
import { NewChatWrapper } from "~/components/chat/new-chat-wrapper";

// Server component for new chats
export default function NewChatPage() {
	const agentId = "c010";

	// Use client wrapper to ensure stable UUID generation
	// The UUID needs to be generated client-side to remain stable across re-renders
	return (
		<Suspense fallback={null}>
			<NewChatWrapper agentId={agentId} />
		</Suspense>
	);
}