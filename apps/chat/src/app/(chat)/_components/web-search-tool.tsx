"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import {
	Tool,
	ToolHeader,
	ToolHeaderMain,
	ToolIcon,
	ToolTitle,
} from "@repo/ui/components/ai-elements/tool";
import {
	AlertCircle,
	ExternalLink,
	Globe,
	Loader2,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import type { WebSearchToolUIPart } from "@repo/chat-ai-types";
import { formatToolErrorPayload } from "./tool-error-utils";

const DEFAULT_ERROR_MESSAGE =
	"We couldn't complete the web search. Please try again.";

interface WebSearchResult {
	title: string;
	url: string;
	content: string;
	contentType: string;
	score?: number;
}

const toHostname = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
};

export interface WebSearchToolProps {
	toolPart: WebSearchToolUIPart;
}

export const WebSearchTool = memo(function WebSearchTool({
	toolPart,
}: WebSearchToolProps) {
	const metadata = { displayName: "Web Search" };

	const input = toolPart.input as { query?: string } | undefined;
	const searchQuery = input?.query;

	switch (toolPart.state) {
		case "input-streaming":
		case "input-available": {
			const isPreparing = toolPart.state === "input-streaming";
			const icon = isPreparing ? (
				<Sparkles className="h-4 w-4 animate-pulse text-blue-500" />
			) : (
				<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
			);

			const labelPrefix = isPreparing
				? "Preparing Web Search"
				: "Web Search running";
			const label = searchQuery
				? `${labelPrefix}: "${searchQuery}"`
				: `${labelPrefix}...`;

			return (
				<Tool className="my-6">
					<ToolHeader>
						<ToolIcon>{icon}</ToolIcon>
						<ToolHeaderMain>
							<ToolTitle className="text-sm">{label}</ToolTitle>
						</ToolHeaderMain>
					</ToolHeader>
				</Tool>
			);
		}
		case "output-error": {
			const { formattedError, isStructured } = formatToolErrorPayload(
				toolPart.errorText,
				DEFAULT_ERROR_MESSAGE,
			);

			return (
				<div className="my-6 border rounded-lg w-full">
					<Accordion type="single" collapsible className="w-full">
						<AccordionItem value="web-search-error">
							<AccordionTrigger className="items-center px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
								<div className="flex flex-1 items-center gap-2">
									<AlertCircle className="h-4 w-4 text-destructive" />
									<div className="flex-1 text-left">
										<div className="text-xs font-medium text-destructive">
											{metadata.displayName} failed
										</div>
									</div>
								</div>
							</AccordionTrigger>
							<AccordionContent className="px-4">
								<div className="pb-4 pt-3">
									{isStructured ? (
										<pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-2xs leading-relaxed text-muted-foreground">
											{formattedError}
										</pre>
									) : (
										<p className="text-2xs text-muted-foreground">
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
		case "output-available": {
			const output = toolPart.output as
				| { results?: WebSearchResult[] }
				| undefined;
			const results = output?.results;
			const resultCount = results?.length ?? 0;

			return (
				<div className="my-6 border rounded-lg w-full">
					<Accordion type="single" collapsible className="w-full">
						<AccordionItem value="web-search-results">
							<AccordionTrigger className="items-center px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
								<div className="flex flex-1 items-center gap-2">
									<Globe className="h-4 w-4 text-muted-foreground" />
									<div className="flex-1 text-left">
										<div className="text-xs font-medium lowercase text-muted-foreground">
											{searchQuery ?? metadata.displayName}
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
										{results.map((result, index) => (
											<div key={`web-search-result-${index}`}>
												<Link
													href={result.url}
													target="_blank"
													rel="noopener noreferrer"
													className="group flex items-center gap-3 rounded-sm px-3 py-2 hover:bg-muted/50"
												>
													<h4 className="flex-1 truncate text-xs font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
														{result.title}
													</h4>
													<span className="shrink-0 text-xs text-muted-foreground/70">
														{toHostname(result.url)}
													</span>
													<ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
												</Link>
											</div>
										))}
									</div>
								) : (
									<p className="py-2 text-sm text-muted-foreground">
										No results found.
									</p>
								)}
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			);
		}
		default:
			return null;
	}
});
