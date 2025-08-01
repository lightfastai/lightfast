import type { UIMessage } from "ai";
import { ChatInputSection } from "./chat-input-section";

interface ChatInterfaceProps {
	agentId: string;
	threadId: string;
	initialMessages?: UIMessage[];
}

/**
 * V2 ChatInterface with streaming support
 */
export function ChatInterface({ agentId, threadId, initialMessages = [] }: ChatInterfaceProps) {
	// Use key prop to force complete remount when threadId changes
	return (
		<div className="flex-1 flex flex-col relative h-screen">
			<ChatInputSection
				key={`${agentId}-${threadId}`}
				agentId={agentId}
				threadId={threadId}
				initialMessages={initialMessages}
			/>
		</div>
	);
}
