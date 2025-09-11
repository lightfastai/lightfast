"use client";

import type { ToolUIPart } from "ai";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import {
	AlertCircle,
	ExternalLink,
	Globe,
	Loader2,
	Search,
	Sparkles,
	FileCode,
} from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface ToolCallRendererProps {
	toolPart: ToolUIPart;
	toolName: string;
	className?: string;
}

// Type-safe input/output types for webSearch
interface WebSearchInput {
	query?: string;
}

interface WebSearchResult {
	title: string;
	url: string;
	snippet?: string;
}

interface WebSearchOutput {
	results?: WebSearchResult[];
}

// Type-safe input/output types for createDocument
interface CreateDocumentInput {
	title?: string;
	kind?: string;
}

interface CreateDocumentOutput {
	id?: string;
	title?: string;
	kind?: string;
	content?: string;
}

export interface WebSearchToolProps {
	toolPart: ToolUIPart;
	error?: Error;
}

export const CreateDocumentTool = memo(function CreateDocumentTool({
	toolPart,
	error,
}: WebSearchToolProps) {
	const metadata = { displayName: "Create Document" };

	// Determine state based on AI SDK ToolUIPart structure
	const state = (() => {
		if (error) return "error";
		if ("state" in toolPart) {
			switch (toolPart.state) {
				case "output-available":
					return "output-available";
				case "executing":
				case "streaming":
					return "input-available";
				default:
					return "input-streaming";
			}
		}
		// Fallback logic
		if ("output" in toolPart && toolPart.output !== undefined)
			return "output-available";
		if ("input" in toolPart && toolPart.input !== undefined)
			return "input-available";
		return "input-streaming";
	})();

	// Extract data
	const input = ("input" in toolPart ? toolPart.input : {}) as CreateDocumentInput;
	const documentTitle = input.title;
	const documentKind = input.kind;

	const output = ("output" in toolPart ? toolPart.output : undefined) as
		| CreateDocumentOutput
		| undefined;

	// Handle different states
	if (state === "input-streaming") {
		return (
			<div className="my-2 border rounded-lg px-4 py-3 bg-muted/30">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 animate-pulse text-purple-500" />
					<div className="text-sm">
						<div className="font-medium text-muted-foreground">
							Preparing {metadata.displayName}...
						</div>
						{documentTitle && (
							<p className="text-xs text-muted-foreground/70 mt-1">
								Title: "{documentTitle}"
							</p>
						)}
					</div>
				</div>
			</div>
		);
	}

	if (state === "error") {
		return (
			<div className="my-2">
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<div className="font-medium">{metadata.displayName} failed</div>
						{documentTitle && (
							<p className="text-xs mt-1 opacity-80">Title: "{documentTitle}"</p>
						)}
						<p className="text-xs mt-2">
							{error?.message ?? "An error occurred while creating document"}
						</p>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<div className="my-4 border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden flex">
			{/* Left side - Document info */}
			<div className="flex-1 px-4 py-3">
				<div className="text-white font-medium text-sm mb-1">
					{documentTitle || "Dijkstra's Algorithm Implementation"}
				</div>
				<div className="text-zinc-400 text-xs">
					{documentKind || "Code"}
				</div>
			</div>
			
			{/* Right side - Code preview thumbnail */}
			<div className="w-32 h-20 bg-zinc-800 border-l border-zinc-700 flex items-center justify-center">
				<div className="w-6 h-6 bg-zinc-600 rounded opacity-50">
					<FileCode className="w-4 h-4 text-zinc-400 m-1" />
				</div>
			</div>
		</div>
	);
});

export const WebSearchTool = memo(function WebSearchTool({
	toolPart,
	error,
}: WebSearchToolProps) {
	const metadata = { displayName: "Web Search" };

	// Determine state based on AI SDK ToolUIPart structure
	const state = (() => {
		if (error) return "error";
		if ("state" in toolPart) {
			// Use the built-in state from AI SDK
			switch (toolPart.state) {
				case "output-available":
					return "output-available";
				case "executing":
				case "streaming":
					return "input-available";
				default:
					return "input-streaming";
			}
		}
		// Fallback logic for older versions
		if ("output" in toolPart && toolPart.output !== undefined)
			return "output-available";
		if ("input" in toolPart && toolPart.input !== undefined)
			return "input-available";
		return "input-streaming";
	})();

	// Debug logging
	console.log(
		"WebSearchTool - state:",
		state,
		"toolPart.state:",
		toolPart.state,
	);

	// Extract data based on AI SDK structure
	const input = ("input" in toolPart ? toolPart.input : {}) as WebSearchInput;
	const searchQuery = input.query;

	// Get output if available
	const output = ("output" in toolPart ? toolPart.output : undefined) as
		| WebSearchOutput
		| undefined;
	const results = output?.results;
	const resultCount = results?.length ?? 0;

	const accordionValue = `web-search-${Math.random().toString(36).substr(2, 9)}`;

	// Handle different states
	if (state === "input-streaming") {
		return (
			<div className="my-2 border rounded-lg px-4 py-3 bg-muted/30">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 animate-pulse text-blue-500" />
					<div className="text-sm">
						<div className="font-medium text-muted-foreground">
							Preparing {metadata.displayName}...
						</div>
						{searchQuery && (
							<p className="text-xs text-muted-foreground/70 mt-1">
								Query: "{searchQuery}"
							</p>
						)}
					</div>
				</div>
			</div>
		);
	}

	if (state === "error") {
		return (
			<div className="my-2">
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<div className="font-medium">{metadata.displayName} failed</div>
						{searchQuery && (
							<p className="text-xs mt-1 opacity-80">Query: "{searchQuery}"</p>
						)}
						<p className="text-xs mt-2">
							{error?.message ?? "An error occurred while searching"}
						</p>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<div className="my-6 border rounded-lg">
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value={accordionValue}>
					<AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
						<div className="flex items-center gap-2 flex-1">
							{state === "input-available" ? (
								<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
							) : (
								<Globe className="h-4 w-4 text-muted-foreground" />
							)}
							<div className="text-left flex-1">
								<div className="font-medium text-xs lowercase text-muted-foreground">
									{state === "input-available" ? "searching..." : searchQuery}
								</div>
							</div>
							{state === "output-available" && (
								<span className="text-xs text-muted-foreground/70">
									{resultCount} results
								</span>
							)}
						</div>
					</AccordionTrigger>
					<AccordionContent className="px-4">
						{state === "input-available" ? (
							<div className="pt-3">
								<div className="group flex items-center gap-3 rounded-lg p-2 px-3">
									<Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
									<span className="text-xs font-medium text-muted-foreground flex-1">
										Searching for relevant information...
									</span>
								</div>
							</div>
						) : results && results.length > 0 ? (
							<div className="pt-3">
								{results.map((result, index) => (
									<div key={`web-search-result-${index}`}>
										<Link
											href={result.url}
											target="_blank"
											rel="noopener noreferrer"
											className="group flex items-center gap-3 hover:bg-muted/50 rounded-sm p-2 px-3"
										>
											<h4 className="text-xs font-medium text-foreground flex-1 truncate">
												{result.title}
											</h4>
											<span className="text-xs text-muted-foreground/70 shrink-0">
												{new URL(result.url).hostname}
											</span>
											<ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
										</Link>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground py-2">
								No results found.
							</p>
						)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
});

export function ToolCallRenderer({
	toolPart,
	toolName,
	className,
}: ToolCallRendererProps) {
	// Debug logging to understand tool names
	console.log("ToolCallRenderer - toolName:", toolName, "toolPart:", toolPart);

	// Enhanced renderers for specific tools
	if (toolName === "webSearch") {
		return <WebSearchTool toolPart={toolPart} />;
	}

	if (toolName === "createDocument") {
		return <CreateDocumentTool toolPart={toolPart} />;
	}

	// Basic renderer for other tools
	if ("input" in toolPart) {
		const input = toolPart.input as Record<string, unknown>;
		const firstArg = Object.values(input)[0];
		const displayText =
			typeof firstArg === "string" ? firstArg : JSON.stringify(firstArg);

		return (
			<div
				className={cn(
					"flex items-center gap-2 text-xs text-muted-foreground",
					className,
				)}
			>
				<Search className="w-3 h-3" />
				<span>
					Running {toolName}: {displayText}
				</span>
			</div>
		);
	}

	// Default fallback for unknown tools
	return (
		<div
			className={cn(
				"flex items-center gap-2 text-xs text-muted-foreground",
				className,
			)}
		>
			<span>Running: {toolName}</span>
		</div>
	);
}
