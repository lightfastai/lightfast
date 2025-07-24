"use client";

import type { ExperimentalAgentId } from "@lightfast/types";
import { Info } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

interface AgentInfoModalProps {
	agentId?: ExperimentalAgentId;
}

export function AgentInfoModal({ agentId }: AgentInfoModalProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon" className="h-8 w-8">
					<Info className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px] overflow-hidden p-0">
				<div className="relative w-full h-[200px]">
					<Image
						src="/og.jpg"
						alt="Lightfast AI"
						fill
						className="object-cover"
						priority
					/>
				</div>
				<div className="p-6">
					<DialogTitle className="sr-only">About Lightfast AI</DialogTitle>
					<DialogDescription className="sr-only">
						Information about Lightfast AI and the current agent version
					</DialogDescription>
					<div className="space-y-4">
						{agentId && (
							<div className="space-y-2">
								<p className="font-mono text-xs text-foreground">Agent Version: {agentId}</p>
								<p className="text-sm text-muted-foreground">
									This is the current agent version that you are using for this conversation. It will change as we
									upgrade the agent capabilities.
								</p>
							</div>
						)}
						<p className="text-sm text-muted-foreground">
							Lightfast AI is an experimental AI assistant platform that showcases different agent capabilities and
							interaction models.
						</p>
						<p className="text-sm text-muted-foreground">
							Each agent version represents different capabilities and improvements in our AI system, from basic
							conversation to advanced task automation and tool usage.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
