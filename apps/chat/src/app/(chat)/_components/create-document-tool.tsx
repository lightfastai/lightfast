"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import {
	AlertCircle,
	FileCode,
	Loader2,
} from "lucide-react";
import { memo, useMemo } from "react";
import type { CreateDocumentToolUIPart } from "~/ai/lightfast-app-chat-ui-messages";
import { formatToolErrorPayload } from "./tool-error-utils";

export interface CreateDocumentToolProps {
	toolPart: CreateDocumentToolUIPart;
	onArtifactClick?: (artifactId: string) => void;
}

const DEFAULT_ERROR_MESSAGE = "We couldn't create the document. Please try again.";
const ERROR_PANEL_ID = "create-document-error";

export const CreateDocumentTool = memo(function CreateDocumentTool({
	toolPart,
	onArtifactClick,
}: CreateDocumentToolProps) {
	// Extract input data with explicit typing to avoid any inference
	const input = toolPart.input as { title?: string; kind?: string } | undefined;
	const rawTitle = input?.title;
	const documentKind = input?.kind;

	// Truncate title if more than 4 words
	const documentTitle = rawTitle && rawTitle.split(' ').length > 4 
		? rawTitle.split(' ').slice(0, 4).join(' ') + '...'
		: rawTitle;

	const { formattedError, isStructured } = useMemo(
		() => formatToolErrorPayload(toolPart.errorText, DEFAULT_ERROR_MESSAGE),
		[toolPart.errorText],
	);

	// Handle output-error state - collapse to a single accordion row
	if (toolPart.state === "output-error") {
		return (
			<div className="my-6 border rounded-lg w-full">
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value={ERROR_PANEL_ID}>
						<AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
							<div className="flex items-center gap-2 flex-1">
								<AlertCircle className="h-4 w-4 text-destructive" />
								<div className="text-left flex-1">
									<div className="font-medium text-sm text-destructive">
										Create document failed
									</div>
								</div>
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-4">
							<div className="pt-3 pb-4 space-y-3">
								{documentTitle && (
									<p className="text-xs text-muted-foreground">Title: "{documentTitle}"</p>
								)}
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

	// For all other states (input-streaming, input-available, output-available),
	// show the same document card UI
	const artifactId = toolPart.state === "output-available" 
		? (toolPart.output as { id?: string } | undefined)?.id
		: undefined;

	return (
		<div className="my-6 border rounded-lg overflow-hidden w-full">
			<div 
				className="flex hover:bg-muted/50 transition-colors cursor-pointer min-h-[4rem] w-full"
				onClick={() => {
					if (artifactId && onArtifactClick) {
						onArtifactClick(artifactId);
					}
				}}
			>
				{/* Left side - Document info */}
				<div className="flex-1 px-4 py-3">
					{documentTitle && (
						<div className="text-foreground font-medium text-sm mb-1">
							{documentTitle}
						</div>
					)}
					{documentKind && (
						<div className="text-muted-foreground text-xs capitalize">
							{documentKind}
						</div>
					)}
				</div>

				{/* Right side - Code preview thumbnail with loading state */}
				<div className="w-32 self-stretch bg-muted/30 border-l flex items-center justify-center">
					{toolPart.state === "input-streaming" || toolPart.state === "input-available" ? (
						<Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
					) : (
						<div className="w-6 h-6 bg-muted-foreground/20 rounded">
							<FileCode className="w-4 h-4 text-muted-foreground m-1" />
						</div>
					)}
				</div>
			</div>
		</div>
	);
});
