import { AuthenticatedHeader } from "../layouts/authenticated-header";

interface ChatLayoutProps {
	children: React.ReactNode;
	agentId?: string;
	version?: "v1" | "v2";
}

export function ChatLayout({ children, agentId, version = "v1" }: ChatLayoutProps) {
	return (
		<main className="flex h-screen flex-col relative">
			<div className="relative h-full">
				<AuthenticatedHeader agentId={agentId} version={version} />
				<div className="flex-1 flex flex-col h-full">{children}</div>
			</div>
		</main>
	);
}
