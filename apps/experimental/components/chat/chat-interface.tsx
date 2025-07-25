import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { ChatInputSection } from "./chat-input-section";

interface ChatInterfaceProps {
	agentId: string;
	threadId: string;
	initialMessages?: LightfastUIMessage[];
}

/**
 * ChatInterface with optimized server/client boundaries
 * Server-renders static content and progressively enhances with client features
 */
export function ChatInterface({ agentId, threadId, initialMessages = [] }: ChatInterfaceProps) {
	// Always use the client component for the full chat experience
	// This ensures real-time updates work properly
	// Use key prop to force complete remount when threadId changes
	return (
		<div className="flex-1 flex flex-col relative">
			<ChatInputSection
				key={`${agentId}-${threadId}`}
				agentId={agentId}
				threadId={threadId}
				initialMessages={initialMessages}
			/>
		</div>
	);
}
