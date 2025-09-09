"use client";

import { useState, useEffect } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, AlertCircle } from "lucide-react";
import { ChatInterface } from "../_components/chat-interface";
import { useTRPC } from "~/trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	Alert,
	AlertDescription,
} from "@repo/ui/components/ui/alert";

export default function AgentChatPage() {
	const params = useParams();
	const router = useRouter();
	const orgSlug = params.slug as string;
	const agentName = decodeURIComponent(params.agentName as string);
	const [sessionId, setSessionId] = useState<string>("");
	const trpc = useTRPC();

	// Fetch agents to validate the current agent exists
	const agentsQuery = useQuery({
		...trpc.agent.list.queryOptions(),
		staleTime: 30000,
	});

	// Generate session ID on mount
	useEffect(() => {
		setSessionId(
			`chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		);
	}, [agentName]); // Reset session when agent changes

	// Check if agent exists
	const currentAgent = agentsQuery.data?.agents?.find(
		(agent) => agent.name === agentName,
	);

	// Show loading state while fetching agents or generating session
	if (!sessionId || agentsQuery.isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
					<p className="text-muted-foreground">
						{!sessionId ? "Initializing chat..." : "Loading agent..."}
					</p>
				</div>
			</div>
		);
	}

	// Show error if agents failed to load
	if (agentsQuery.isError) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<Alert variant="destructive" className="max-w-md">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<div className="font-medium mb-1">Failed to load agent</div>
						<div className="text-sm opacity-90">
							{agentsQuery.error?.message || "Unknown error"}
						</div>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	// Show 404 if agent doesn't exist
	if (!currentAgent) {
		notFound();
	}

	const handleChatError = (err: Error) => {
		console.error("[AgentChatPage] Error:", err);
	};

	const handleAgentChange = (newAgentName: string) => {
		if (newAgentName !== agentName) {
			router.push(`/orgs/${orgSlug}/agent/${newAgentName}`);
		}
	};

	return (
		<div className="h-full bg-background flex flex-col relative">
			{/* Agent Selector Header - Absolute positioned */}
			<div className="absolute top-0 left-0 right-0 z-20 p-4">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="font-medium">
							{agentName}
							<ChevronDown className="w-4 h-4 ml-2" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-48">
						{agentsQuery.data?.agents?.map((agent) => (
							<DropdownMenuItem
								key={agent.id}
								onClick={() => handleAgentChange(agent.name)}
								className="flex items-center justify-between text-xs"
							>
								<span className="truncate">{agent.name}</span>
								{agentName === agent.name && (
									<div className="w-2 h-2 bg-primary rounded-full" />
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Chat Interface - Full height with top padding */}
			<div className="flex-1">
				<ChatInterface
					agentId={agentName}
					sessionId={sessionId}
					onError={handleChatError}
					className="h-full"
				/>
			</div>
		</div>
	);
}

