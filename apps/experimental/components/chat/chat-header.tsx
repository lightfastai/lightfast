import { Suspense } from "react";
import { AgentInfoModal } from "@/components/agent-info-modal";
import { UserDropdown } from "@/components/user-dropdown";
import { NewChatButton } from "./new-chat-button";

interface ChatHeaderProps {
	agentId?: string;
	version?: "v1" | "v2";
}

/**
 * ChatHeader component with server-side optimizations
 * Renders static structure server-side with client components for interactivity
 */
export function ChatHeader({ agentId, version = "v1" }: ChatHeaderProps) {
	return (
		<>
			{/* Desktop header - hidden on tablets and below */}
			<div className="hidden lg:flex absolute top-4 left-6 right-6 z-20 items-center justify-between">
				<NewChatButton href={version === "v2" ? `/v2-chat/${agentId || "a011"}` : "/"} />
				<div className="flex items-center gap-2">
					<AgentInfoModal agentId={agentId} />
					<UserDropdown />
				</div>
			</div>

			{/* Mobile/Tablet header - visible on tablets and below */}
			<header className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex items-center gap-3">
					<NewChatButton variant="mobile" href={version === "v2" ? `/v2-chat/${agentId || "a011"}` : "/"} />
				</div>
				<div className="flex items-center gap-2">
					<AgentInfoModal agentId={agentId} />
					<UserDropdown />
				</div>
			</header>
		</>
	);
}
