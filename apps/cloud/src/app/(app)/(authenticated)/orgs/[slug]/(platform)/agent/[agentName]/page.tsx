"use client";

import { useState, useEffect } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, AlertCircle, X } from "lucide-react";
import { ChatInterface } from "../_components/chat-interface";
import { useTRPC } from "~/trpc/react";
import { useCloudChat } from "~/hooks/use-cloud-chat";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { CardHeader } from "@repo/ui/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export default function AgentChatPage() {
	const params = useParams();
	const router = useRouter();
	const orgSlug = params.slug as string;
	const agentName = decodeURIComponent(params.agentName as string);
	const [sessionId, setSessionId] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const trpc = useTRPC();

	// Fetch agents to validate the current agent exists
	const agentsQuery = useQuery({
		...trpc.agent.list.queryOptions(),
		staleTime: 30000,
	});

	// Generate session ID on mount
	useEffect(() => {
		setSessionId(
			`chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		);
	}, [agentName]); // Reset session when agent changes

	// Use the cloud chat hook to get the status
	const { status } = useCloudChat({
		agentId: agentName,
		sessionId: sessionId || "",
		initialMessages: [],
		onError: (err) => {
			setError(err.message || "An error occurred");
		},
	});

	// Check if agent exists
	const currentAgent = agentsQuery.data?.agents?.find(
		(agent) => agent.name === agentName
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
		setError(err.message);
	};

	const clearError = () => setError(null);

	const handleAgentChange = (newAgentName: string) => {
		if (newAgentName !== agentName) {
			router.push(`/orgs/${orgSlug}/agent/${newAgentName}`);
		}
	};

	return (
		<div className="min-h-screen bg-background flex flex-col">
			{/* Global Error Banner */}
			{error && (
				<div className="flex-shrink-0 p-3">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription className="flex items-center justify-between w-full">
							<div>
								<div className="font-medium">Chat Error</div>
								<div className="text-sm opacity-90">{error}</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={clearError}
								className="h-auto w-auto p-0 text-destructive hover:text-destructive/80"
							>
								<X className="h-4 w-4" />
							</Button>
						</AlertDescription>
					</Alert>
				</div>
			)}

			{/* Chat Interface with Inline Header */}
			<div className="flex-1 flex flex-col">
				<ChatInterface
					agentId={agentName}
					sessionId={sessionId}
					onError={handleChatError}
					className="flex-1"
					customHeader={
						<CardHeader className="flex-shrink-0 border-b">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-4">
									{/* Agent Selector Dropdown */}
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

								{/* Session Info & Status */}
								<div className="flex items-center gap-4">
									<div className="text-right">
										<div className="text-sm font-medium text-foreground">
											Session: {sessionId.slice(-8)}
										</div>
										<div className="flex items-center gap-2 justify-end">
											<Badge 
												variant={
													status === "streaming" ? "default" :
													status === "submitted" ? "secondary" :
													status === "error" ? "destructive" :
													"outline"
												}
												className={cn(
													"text-xs",
													status === "streaming" && "animate-pulse",
													status === "submitted" && "animate-pulse"
												)}
											>
												{status}
											</Badge>
										</div>
									</div>
								</div>
							</div>
						</CardHeader>
					}
				/>
			</div>
		</div>
	);
}