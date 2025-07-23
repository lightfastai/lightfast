"use client";

import type { ExperimentalAgentId } from "@lightfast/types";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface AgentVersionIndicatorProps {
	agentId: ExperimentalAgentId;
	variant?: "default" | "mobile";
}

export function AgentVersionIndicator({ agentId, variant = "default" }: AgentVersionIndicatorProps) {
	if (variant === "mobile") {
		return (
			<div className="flex items-center gap-1">
				<span className="font-mono text-xs text-muted-foreground">v: {agentId}</span>
				<Popover>
					<PopoverTrigger asChild>
						<button type="button" className="hover:opacity-70 transition-opacity">
							<Info className="h-3 w-3 text-muted-foreground" />
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-80" side="bottom" align="start">
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">
								This is the current agent version that you are using for this conversation. It will change as we upgrade
								the agent capabilities.
							</p>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		);
	}

	return (
		<div className="fixed bottom-6 right-6 z-10 flex items-center gap-1">
			<span className="font-mono text-xs text-muted-foreground">version: {agentId}</span>
			<Popover>
				<PopoverTrigger asChild>
					<button type="button" className="hover:opacity-70 transition-opacity">
						<Info className="h-3 w-3 text-muted-foreground" />
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-80" side="top" align="end">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							This is the current agent version that you are using for this conversation. It will change as we upgrade
							the agent capabilities.
						</p>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
