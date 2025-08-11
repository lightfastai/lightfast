"use client";

import type { ToolUIPart } from "ai";
import { Search } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface ToolCallRendererProps {
	toolPart: ToolUIPart;
	toolName: string;
	className?: string;
}

export function ToolCallRenderer({ toolPart, toolName, className }: ToolCallRendererProps) {
	// For web search tool
	if (toolName === "webSearch") {
		const args = toolPart.args as { query?: string };
		return (
			<div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
				<Search className="w-3 h-3" />
				<span>Searching: {args.query || "..."}</span>
			</div>
		);
	}

	// Default fallback for unknown tools
	return (
		<div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
			<span>Running: {toolName}</span>
		</div>
	);
}