import type { ExperimentalAgentId } from "@lightfast/types";
import { Suspense } from "react";
import { AgentInfoModal } from "@/components/agent-info-modal";
import { UserDropdown } from "@/components/user-dropdown";
import { NewChatButton } from "./new-chat-button";

interface ChatHeaderProps {
	agentId?: ExperimentalAgentId;
}

/**
 * ChatHeader component with server-side optimizations
 * Renders static structure server-side with client components for interactivity
 */
export function ChatHeader({ agentId }: ChatHeaderProps) {
	return (
		<>
			{/* Desktop header - hidden on tablets and below */}
			<div className="hidden lg:flex absolute top-4 left-6 right-6 z-20 items-center justify-between">
				<Suspense fallback={<div className="h-8 w-20" />}>
					<NewChatButton />
				</Suspense>
				<div className="flex items-center gap-2">
					<AgentInfoModal agentId={agentId} />
					<UserDropdown />
				</div>
			</div>

			{/* Mobile/Tablet header - visible on tablets and below */}
			<header className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex items-center gap-3">
					<Suspense fallback={<div className="h-8 w-8" />}>
						<NewChatButton variant="mobile" />
					</Suspense>
				</div>
				<div className="flex items-center gap-2">
					<AgentInfoModal agentId={agentId} />
					<UserDropdown />
				</div>
			</header>
		</>
	);
}
