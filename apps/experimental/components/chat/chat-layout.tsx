import type { ExperimentalAgentId } from "@lightfast/types";
import { ChatHeader } from "./chat-header";

interface ChatLayoutProps {
	children: React.ReactNode;
	agentId?: ExperimentalAgentId;
}

export function ChatLayout({ children, agentId }: ChatLayoutProps) {
	return (
		<main className="flex h-screen flex-col relative">
			<ChatHeader agentId={agentId} />
			<div className="flex-1 flex flex-col lg:pt-0 min-h-0">{children}</div>
		</main>
	);
}
