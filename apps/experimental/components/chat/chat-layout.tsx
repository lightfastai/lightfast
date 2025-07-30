import { ChatHeader } from "./chat-header";

interface ChatLayoutProps {
	children: React.ReactNode;
	agentId?: string;
	version?: "v1" | "v2";
}

export function ChatLayout({ children, agentId, version = "v1" }: ChatLayoutProps) {
	return (
		<main className="flex h-screen flex-col relative">
			<ChatHeader agentId={agentId} version={version} />
			<div className="flex-1 flex flex-col lg:pt-0 min-h-0">{children}</div>
		</main>
	);
}
