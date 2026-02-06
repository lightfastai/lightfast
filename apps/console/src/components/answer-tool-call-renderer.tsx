"use client";

import React, { memo } from "react";
import type { ToolUIPart } from "ai";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import {
	Tool,
	ToolHeader,
	ToolIcon,
	ToolHeaderMain,
	ToolTitle,
	ToolDescription,
} from "@repo/ui/components/ai-elements/tool";
import {
	AlertCircle,
	Search,
	FileText,
	Layers,
	GitBranch,
	Link as LinkIcon,
	Loader2,
	Sparkles,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
	SearchToolResult,
	ContentsToolResult,
	FindSimilarToolResult,
} from "./answer-tool-results";
import { formatToolErrorPayload } from "./answer-tool-error-utils";

interface ToolCallRendererProps {
	toolPart: ToolUIPart;
	toolName: string;
	className?: string;
}

// Tool metadata for each console tool
const TOOL_METADATA: Record<
	string,
	{
		displayName: string;
		loadingLabel: string;
		icon: React.ReactNode;
	}
> = {
	workspaceSearch: {
		displayName: "Search",
		loadingLabel: "Searching workspace...",
		icon: <Search className="h-4 w-4" />,
	},
	workspaceContents: {
		displayName: "Contents",
		loadingLabel: "Fetching content...",
		icon: <FileText className="h-4 w-4" />,
	},
	workspaceFindSimilar: {
		displayName: "Find Similar",
		loadingLabel: "Finding similar...",
		icon: <Layers className="h-4 w-4" />,
	},
	workspaceGraph: {
		displayName: "Graph",
		loadingLabel: "Traversing relationships...",
		icon: <GitBranch className="h-4 w-4" />,
	},
	workspaceRelated: {
		displayName: "Related",
		loadingLabel: "Finding related events...",
		icon: <LinkIcon className="h-4 w-4" />,
	},
};

function ToolLoadingState({
	toolName: toolNameProp,
	toolPart,
	isStreaming,
}: {
	toolName: string;
	toolPart: ToolUIPart;
	isStreaming: boolean;
}) {
	const metadata = TOOL_METADATA[toolNameProp];
	if (!metadata) {
		return null;
	}

	const { displayName, loadingLabel } = metadata;

	// Extract input preview if available
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

	return (
		<Tool className={cn("my-6 border border-border/50")}>
			<ToolHeader className="bg-muted/50">
				<ToolIcon className="text-muted-foreground">
					{isStreaming ? (
						<Sparkles className="h-4 w-4 animate-pulse" />
					) : (
						<Loader2 className="h-4 w-4 animate-spin" />
					)}
				</ToolIcon>
				<ToolHeaderMain>
					<ToolTitle className="text-xs font-medium text-muted-foreground">
						{displayName}
					</ToolTitle>
					<ToolDescription>{loadingLabel}</ToolDescription>
					{inputPreview && (
						<div className="text-xs text-muted-foreground/70 truncate mt-1">
							{inputPreview}
						</div>
					)}
				</ToolHeaderMain>
			</ToolHeader>
		</Tool>
	);
}

export const ToolCallRenderer = memo(function ToolCallRenderer({
	toolPart,
	toolName,
	className,
}: ToolCallRendererProps) {
	// Handle 4-state lifecycle
	if ("state" in toolPart) {
		const state = toolPart.state as string;

		// input-streaming: Sparkles icon with "{displayName}..."
		if (state === "input-streaming") {
			return (
				<ToolLoadingState
					toolName={toolName}
					toolPart={toolPart}
					isStreaming={true}
				/>
			);
		}

		// input-available: Loader2 icon with loading label
		if (state === "input-available") {
			return (
				<ToolLoadingState
					toolName={toolName}
					toolPart={toolPart}
					isStreaming={false}
				/>
			);
		}

		// output-error: Show error in collapsible accordion
		if (state === "output-error") {
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

			const metadata = TOOL_METADATA[toolName];
			const errorLabel = metadata
				? `${metadata.displayName} failed`
				: "Tool execution failed";

			return (
				<div className={cn("my-6 border rounded-lg w-full", className)}>
					<Accordion type="single" collapsible className="w-full">
						<AccordionItem value={`tool-error-${toolName || "unknown"}`}>
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
										<p className="text-xs text-muted-foreground">
											{formattedError}
										</p>
									)}
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			);
		}

		// output-available: Dispatch to appropriate result component
		if (state === "output-available") {
			const output = "output" in toolPart ? toolPart.output : undefined;

			if (!output) {
				return null;
			}

			// Dispatch to tool-specific result components
			switch (toolName) {
				case "workspaceSearch":
					return (
						<div className={cn("w-full", className)}>
							<SearchToolResult data={output as Parameters<typeof SearchToolResult>[0]["data"]} />
						</div>
					);

				case "workspaceContents":
					return (
						<div className={cn("w-full", className)}>
							<ContentsToolResult data={output as Parameters<typeof ContentsToolResult>[0]["data"]} />
						</div>
					);

				case "workspaceFindSimilar":
					return (
						<div className={cn("w-full", className)}>
							<FindSimilarToolResult data={output as Parameters<typeof FindSimilarToolResult>[0]["data"]} />
						</div>
					);

				// JSON fallback for workspaceGraph and workspaceRelated
				case "workspaceGraph":
				case "workspaceRelated":
					{
						const jsonStr =
							typeof output === "string"
								? output
								: JSON.stringify(output, null, 2);

						const metadata = TOOL_METADATA[toolName];
						const displayName = metadata?.displayName ?? toolName;

						return (
							<div className={cn("my-6 border rounded-lg w-full", className)}>
								<Accordion type="single" collapsible className="w-full">
									<AccordionItem value={`tool-output-${toolName}`}>
										<AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50">
											<div className="flex items-center gap-2 flex-1">
												{metadata?.icon}
												<div className="text-left flex-1">
													<div className="font-medium text-sm">
														{displayName}
													</div>
												</div>
											</div>
										</AccordionTrigger>
										<AccordionContent className="px-4">
											<div className="pt-3 pb-4">
												<pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
													{jsonStr}
												</pre>
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</div>
						);
					}

				default: {
					// Fallback for unknown tools
					const jsonStr =
						typeof output === "string"
							? output
							: JSON.stringify(output, null, 2);
					return (
						<div className={cn("my-6 border rounded-lg w-full", className)}>
							<div className="py-3 px-4 bg-muted/30">
								<pre className="text-xs bg-muted/30 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
									{jsonStr}
								</pre>
							</div>
						</div>
					);
				}
			}
		}
	}

	// Fallback if state is not recognized
	return null;
});
