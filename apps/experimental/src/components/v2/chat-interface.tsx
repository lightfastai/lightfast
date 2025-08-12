import type { UIMessage } from "ai";
import { ChatInputSection } from "./chat-input-section";

interface ChatInterfaceProps {
	agentId: string;
	sessionId: string;
	initialMessages?: UIMessage[];
}

/**
 * V2 ChatInterface with streaming support
 */
export function ChatInterface({ agentId, sessionId, initialMessages = [] }: ChatInterfaceProps) {
	// Use key prop to force complete remount when sessionId changes
	return (
		<div className="flex-1 flex flex-col relative h-screen">
			<ChatInputSection
				key={`${agentId}-${sessionId}`}
				agentId={agentId}
				sessionId={sessionId}
				initialMessages={initialMessages}
			/>
		</div>
	);
}
