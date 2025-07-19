"use client";

import { AlertCircle, ExternalLink, Globe, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface WebSearchToolProps {
	toolPart: any;
}

export const WebSearchTool = memo(function WebSearchTool({ toolPart }: WebSearchToolProps) {
	// Determine state based on toolPart.state
	const state = toolPart.state;
	const searchQuery = toolPart.input?.query;
	const results = toolPart.output?.results;
	const resultCount = results?.length || 0;
	const error = toolPart.errorText;

	const accordionValue = `web-search-${toolPart.toolCallId}`;

	// Handle different states
	if (state === "input-streaming") {
		return (
			<div className="my-2 border rounded-lg px-4 py-3 bg-muted/30">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 animate-pulse text-blue-500" />
					<div className="text-sm">
						<div className="font-medium text-muted-foreground">Preparing Web Search...</div>
						{searchQuery && <p className="text-xs text-muted-foreground/70 mt-1">Query: "{searchQuery}"</p>}
					</div>
				</div>
			</div>
		);
	}

	if (state === "output-error") {
		return (
			<div className="my-2">
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<div className="font-medium">Web Search failed</div>
						{searchQuery && <p className="text-xs mt-1 opacity-80">Query: "{searchQuery}"</p>}
						<p className="text-xs mt-2">{error || "An error occurred while searching"}</p>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<div className="my-6 border rounded-lg w-full">
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
								<span className="text-xs text-muted-foreground/70">{resultCount} results</span>
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
								{results.map((result: any, index: number) => (
									<div key={`${toolPart.toolCallId}-result-${index}`}>
										<Link
											href={result.url}
											target="_blank"
											rel="noopener noreferrer"
											className="group flex items-center gap-3 hover:bg-muted/50 rounded-sm p-2 px-3"
										>
											<h4 className="text-xs font-medium text-foreground flex-1 truncate">{result.title}</h4>
											<span className="text-xs text-muted-foreground/70 shrink-0">{new URL(result.url).hostname}</span>
											<ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
										</Link>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground py-2">No results found.</p>
						)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
});
