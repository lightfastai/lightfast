"use client";

import { UserDropdown } from "@/components/user-dropdown";
import type { ExperimentalAgentId } from "@lightfast/types";
import { AgentVersionIndicator } from "./agent-version-indicator";
import { NewChatButton } from "./new-chat-button";

interface ChatHeaderProps {
	agentId?: ExperimentalAgentId;
}

export function ChatHeader({ agentId }: ChatHeaderProps) {
	return (
		<>
			{/* Desktop header - hidden on tablets and below */}
			<div className="hidden lg:flex absolute top-4 left-6 right-6 z-20 items-center justify-between">
				<NewChatButton />
				<UserDropdown />
			</div>

			{/* Mobile/Tablet header - visible on tablets and below */}
			<header className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex items-center gap-3">
					<NewChatButton variant="mobile" />
					{agentId && (
						<div className="flex items-center">
							<AgentVersionIndicator agentId={agentId} variant="mobile" />
						</div>
					)}
				</div>
				<UserDropdown />
			</header>
		</>
	);
}
