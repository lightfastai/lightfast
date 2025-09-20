"use client";

import type { ToolUIPart } from "ai";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { AlertCircle, Search } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { CreateDocumentToolUIPart, WebSearchToolUIPart } from "@repo/chat-core/types";
import { CreateDocumentTool } from "./create-document-tool";
import { WebSearchTool } from "./web-search-tool";
import { formatToolErrorPayload } from "./tool-error-utils";

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

	if (
		"state" in toolPart &&
		toolPart.state === "output-error"
	) {
		const { formattedError, isStructured } = formatToolErrorPayload(
			"errorText" in toolPart ? toolPart.errorText : undefined,
			"The tool failed to complete. Please try again.",
		);

		let inputPreview: string | undefined;
		if ("input" in toolPart) {
			const input = toolPart.input as Record<string, unknown>;
			const firstArg = Object.values(input)[0];
			inputPreview =
				typeof firstArg === "string"
					? firstArg
					: firstArg !== undefined
						? JSON.stringify(firstArg)
						: undefined;
		}

		const accordionValue = `tool-error-${toolName || "unknown"}`;
		const errorLabel = toolName ? `${toolName} failed` : "Tool execution failed";

		return (
			<div className={cn("my-6 border rounded-lg w-full", className)}>
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value={accordionValue}>
						<AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
							<div className="flex items-center gap-2 flex-1">
								<AlertCircle className="h-4 w-4 text-destructive" />
								<div className="text-left flex-1">
									<div className="font-medium text-sm text-destructive">
										{errorLabel}
									</div>
									{inputPreview && (
										<div className="text-xs text-muted-foreground/70 mt-1 truncate">
											{inputPreview}
										</div>
									)}
								</div>
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-4">
							<div className="pt-3 pb-4">
								{isStructured ? (
									<pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-[10px] leading-relaxed text-muted-foreground">
										{formattedError}
									</pre>
								) : (
									<p className="text-xs text-muted-foreground">{formattedError}</p>
								)}
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>
		);
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
