import type { ExperimentalAgentId, LightfastUIMessage } from "@lightfast/types";
import type { ChatStatus } from "ai";
import { Suspense } from "react";
import { AgentVersionIndicator } from "./agent-version-indicator";
import { ChatInputSection } from "./chat-input-section";
import { ChatMessages } from "./chat-messages";
import { EmptyState } from "./empty-state";

interface ChatInterfaceProps {
	agentId: ExperimentalAgentId;
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
	return (
		<div className="flex-1 flex flex-col relative">
			<Suspense fallback={<div className="flex-1" />}>
				<ChatInputSection agentId={agentId} threadId={threadId} initialMessages={initialMessages} />
			</Suspense>

			{/* Server-rendered agent version */}
			<div className="hidden lg:block">
				<AgentVersionIndicator agentId={agentId} />
			</div>
		</div>
	);
}
