"use client";

import type { ToolUIPart } from "ai";
import { Search } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { CreateDocumentToolUIPart, WebSearchToolUIPart } from "~/ai/lightfast-app-chat-ui-messages";
import { CreateDocumentTool } from "./create-document-tool";
import { WebSearchTool } from "./web-search-tool";

interface ToolCallRendererProps {
	toolPart: ToolUIPart;
	toolName: string;
	className?: string;
	onArtifactClick?: (artifactId: string) => void;
}

export function ToolCallRenderer({
	toolPart,
	toolName,
	className,
	onArtifactClick,
}: ToolCallRendererProps) {
	// Enhanced renderers for specific tools with proper typing
	if (toolName === "webSearch") {
		return <WebSearchTool toolPart={toolPart as WebSearchToolUIPart} />;
	}

	if (toolName === "createDocument") {
		return <CreateDocumentTool 
			toolPart={toolPart as CreateDocumentToolUIPart} 
			onArtifactClick={onArtifactClick} 
		/>;
	}

	// Basic renderer for other tools
	if ("input" in toolPart) {
		const input = toolPart.input as Record<string, unknown>;
		const firstArg = Object.values(input)[0];
		const displayText =
			typeof firstArg === "string" ? firstArg : JSON.stringify(firstArg);

		return (
			<div className={cn("my-6 border rounded-lg w-full", className)}>
				<div className="py-3 px-4 hover:bg-muted/50 transition-colors w-full">
					<div className="flex items-center gap-2 flex-1">
						<Search className="h-4 w-4 text-muted-foreground" />
						<div className="text-left flex-1">
							<div className="font-medium text-xs lowercase text-muted-foreground">
								{toolName}: {displayText}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Default fallback for unknown tools
	return (
		<div className={cn("my-6 border rounded-lg w-full", className)}>
			<div className="py-3 px-4 hover:bg-muted/50 transition-colors w-full">
				<div className="flex items-center gap-2 flex-1">
					<Search className="h-4 w-4 text-muted-foreground" />
					<div className="text-left flex-1">
						<div className="font-medium text-xs lowercase text-muted-foreground">
							{toolName}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}