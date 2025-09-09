"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MessageSquare, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useTRPC } from "~/trpc/react";
import { cn } from "~/lib/utils";

export default function AgentPage() {
	const params = useParams();
	const orgSlug = params.slug as string;
	const trpc = useTRPC();

	const { data: agentsData } = useSuspenseQuery({
		...trpc.agent.list.queryOptions(),
		staleTime: 30000,
	});

	if (!agentsData?.agents || agentsData.agents.length === 0) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<MessageSquare className="w-6 h-6 text-gray-400" />
					</div>
					<p className="text-foreground font-medium mb-2">No agents available</p>
					<p className="text-muted-foreground text-sm mb-4">
						No agents have been deployed to your organization yet.
					</p>
					<div className="text-sm text-muted-foreground">
						<p>To deploy an agent:</p>
						<code className="mt-2 inline-block p-2 bg-muted rounded text-xs">
							lightfast deploy
						</code>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-foreground mb-2">
					🤖 AI Agents
				</h1>
				<p className="text-muted-foreground">
					Chat with your organization's deployed AI agents
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{agentsData.agents.map((agent) => (
					<Link
						key={agent.id}
						href={`/orgs/${orgSlug}/agent/${agent.name}`}
						className={cn(
							"group block p-6 bg-card border rounded-lg shadow-sm",
							"transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
							"hover:border-primary/20"
						)}
					>
						<div className="flex items-start justify-between mb-4">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
									<MessageSquare className="w-5 h-5 text-primary" />
								</div>
								<div>
									<h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
										{agent.name}
									</h3>
									<p className="text-sm text-muted-foreground">
										{(agent.metadata as any)?.description || "AI Agent"}
									</p>
								</div>
							</div>
							<div className="flex-shrink-0">
								<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
									Active
								</span>
							</div>
						</div>

						<div className="space-y-3 mb-4">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Calendar className="w-4 h-4" />
								<span>
									Deployed {format(new Date(agent.createdAt), "MMM d, yyyy")}
								</span>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<span className="font-medium">ID:</span>
								<span className="font-mono text-xs">
									{agent.id.slice(0, 8)}...
								</span>
							</div>
						</div>

						<div className="flex items-center justify-between pt-4 border-t">
							<div className="flex items-center gap-2 text-sm text-primary">
								<MessageSquare className="w-4 h-4" />
								<span>Start Chat</span>
							</div>
							<div className="flex items-center gap-2">
								<a
									href={agent.bundleUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
									onClick={(e) => e.stopPropagation()}
								>
									<ExternalLink className="w-3 h-3" />
									Bundle
								</a>
							</div>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}