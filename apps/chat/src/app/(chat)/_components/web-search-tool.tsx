"use client";

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
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import type { WebSearchToolUIPart } from "~/ai/lightfast-app-chat-ui-messages";

// Type definitions for web search results based on the tool's return structure
interface WebSearchResult {
	title: string;
	url: string;
	content: string;
	contentType: string;
	score?: number;
}

export interface WebSearchToolProps {
	toolPart: WebSearchToolUIPart;
}

export const WebSearchTool = memo(function WebSearchTool({
	toolPart,
}: WebSearchToolProps) {
	const metadata = { displayName: "Web Search" };

	// Extract input data with explicit typing to avoid any inference
	const input = toolPart.input as { query?: string } | undefined;
	const searchQuery = input?.query;
	
	// Extract output data if available with explicit typing
	const output = toolPart.state === "output-available" 
		? toolPart.output as { results?: WebSearchResult[] } | undefined
		: undefined;
	const results = output?.results;
	const resultCount = results?.length ?? 0;

	const accordionValue = `web-search-${Math.random().toString(36).substr(2, 9)}`;

	// Handle input-streaming state
	if (toolPart.state === "input-streaming") {
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

	// Handle input-available state (tool is executing)
	if (toolPart.state === "input-available") {
		return (
			<div className="my-6 border rounded-lg w-full">
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value={accordionValue}>
						<AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
							<div className="flex items-center gap-2 flex-1">
								<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
								<div className="text-left flex-1">
									<div className="font-medium text-xs lowercase text-muted-foreground">
										searching...
									</div>
								</div>
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-4">
							<div className="pt-3">
								<div className="group flex items-center gap-3 rounded-lg p-2 px-3">
									<Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
									<span className="text-xs font-medium text-muted-foreground flex-1">
										Searching for relevant information...
									</span>
								</div>
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>
		);
	}

	// Handle output-error state
	if (toolPart.state === "output-error") {
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
							{toolPart.errorText || "An error occurred while searching"}
						</p>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	// Handle output-available state (tool completed successfully)
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (toolPart.state === "output-available") {
		return (
			<div className="my-6 border rounded-lg w-full">
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value={accordionValue}>
						<AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
							<div className="flex items-center gap-2 flex-1">
								<Globe className="h-4 w-4 text-muted-foreground" />
								<div className="text-left flex-1">
									<div className="font-medium text-xs lowercase text-muted-foreground">
										{searchQuery}
									</div>
								</div>
								<span className="text-xs text-muted-foreground/70">
									{resultCount} results
								</span>
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-4">
							{results && results.length > 0 ? (
								<div className="pt-3">
									{results.map((result: WebSearchResult, index: number) => (
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
	}

	// Fallback for unknown state
	return null;
});