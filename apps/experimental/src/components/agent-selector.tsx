"use client";

import { Ghost } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

// Define the available agent IDs here
const EXPERIMENTAL_AGENT_IDS: string[] = ["a010", "a011"];

const agentDisplayNames: Record<string, string> = {
	a010: "a010",
	a011: "a011",
};

export function AgentSelector() {
	const router = useRouter();
	const params = useParams();
	const currentAgentId = params.agentId as string;
	const sessionId = params.sessionId as string;

	const handleAgentChange = (agentId: string) => {
		// Navigate to the same thread with the new agent
		router.push(`/chat/${agentId}/${sessionId}`);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					<Ghost className="h-4 w-4" />
					<span className="font-medium">{agentDisplayNames[currentAgentId]}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48 space-y-1">
				{EXPERIMENTAL_AGENT_IDS.map((agentId) => (
					<DropdownMenuItem
						key={agentId}
						onClick={() => handleAgentChange(agentId)}
						className={currentAgentId === agentId ? "bg-accent" : ""}
					>
						{agentDisplayNames[agentId]}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
