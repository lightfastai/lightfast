"use client";

import { Badge } from "@lightfast/ui/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@lightfast/ui/components/ui/tooltip";
import { useConvexAuth, useQuery } from "convex/react";
import { Activity } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface TokenUsageHeaderProps {
	threadId: Id<"threads"> | "new";
}

// Helper function to format token counts
function formatTokenCount(count: number): string {
	if (count === 0) return "0";
	if (count < 1000) return count.toString();
	if (count < 1000000) {
		const k = count / 1000;
		return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
	}
	const m = count / 1000000;
	return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
}

export function TokenUsageHeader({ threadId }: TokenUsageHeaderProps) {
	const { isAuthenticated } = useConvexAuth();

	// Check if this is an optimistic thread ID (not a real Convex ID)
	const isOptimisticThreadId = threadId !== "new" && !threadId.startsWith("k");

	// Skip query for new chats, optimistic IDs, or when not authenticated
	const usage = useQuery(
		api.messages.getThreadUsage,
		threadId === "new" || isOptimisticThreadId || !isAuthenticated
			? "skip"
			: { threadId },
	);

	// For new chats, show nothing
	if (threadId === "new") {
		return null;
	}

	// If no usage data yet, show nothing (loading state handled by Suspense)
	if (!usage) {
		return null;
	}

	// Show usage even if 0, as long as we have the data structure
	// This allows showing 0 tokens for new threads that haven't sent messages yet

	return (
		<TooltipProvider>
			<div className="flex items-center gap-2">
				{/* Token Usage Badge */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="outline" className="font-mono">
							<Activity className="w-3 h-3 mr-1" />
							{formatTokenCount(usage.totalTokens)}
						</Badge>
					</TooltipTrigger>
					<TooltipContent>
						<div className="text-xs space-y-1">
							<div>
								Input: {formatTokenCount(usage.totalInputTokens)} tokens
							</div>
							<div>
								Output: {formatTokenCount(usage.totalOutputTokens)} tokens
							</div>
							<div>Total: {formatTokenCount(usage.totalTokens)} tokens</div>
							{usage.totalReasoningTokens > 0 && (
								<div>
									Reasoning: {formatTokenCount(usage.totalReasoningTokens)}{" "}
									tokens
								</div>
							)}
							{usage.totalCachedInputTokens > 0 && (
								<div>
									Cached: {formatTokenCount(usage.totalCachedInputTokens)}{" "}
									tokens
								</div>
							)}
						</div>
					</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	);
}
