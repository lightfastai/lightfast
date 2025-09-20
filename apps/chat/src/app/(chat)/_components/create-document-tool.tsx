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
import { AlertCircle, FileCode, Loader2 } from "lucide-react";
import { memo } from "react";
import type { CreateDocumentToolUIPart } from "@repo/chat-ai/types";
import { formatToolErrorPayload } from "./tool-error-utils";

export interface CreateDocumentToolProps {
	toolPart: CreateDocumentToolUIPart;
	onArtifactClick?: (artifactId: string) => void;
}

const DEFAULT_ERROR_MESSAGE =
	"We couldn't create the document. Please try again.";

const truncateTitle = (title?: string) => {
	if (!title) {
		return undefined;
	}

	const words = title.split(" ");
	return words.length > 4 ? `${words.slice(0, 4).join(" ")}...` : title;
};

export const CreateDocumentTool = memo(function CreateDocumentTool({
	toolPart,
	onArtifactClick,
}: CreateDocumentToolProps) {
	const input = toolPart.input as { title?: string; kind?: string } | undefined;
	const rawTitle = input?.title?.trim();
	const documentKind = input?.kind;
	const documentTitle = truncateTitle(rawTitle);

	switch (toolPart.state) {
		case "input-streaming":
		case "input-available": {
			const isPreparing = toolPart.state === "input-streaming";
			const labelBase = isPreparing
				? "Preparing document creation"
				: "Creating document";
			const label = documentTitle
				? `${labelBase}: "${documentTitle}"`
				: `${labelBase}...`;

			return (
				<Tool className="my-6">
					<ToolHeader>
						<ToolIcon>
							<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
						</ToolIcon>
						<ToolHeaderMain>
							<ToolTitle className="text-xs">{label}</ToolTitle>
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
				<div className="my-6 w-full rounded-lg border">
					<Accordion type="single" collapsible className="w-full">
						<AccordionItem value="create-document-error">
							<AccordionTrigger className="items-center px-4 py-3 hover:no-underline data-[state=closed]:hover:bg-muted/50">
								<div className="flex flex-1 items-center gap-2">
									<AlertCircle className="h-4 w-4 text-destructive" />
									<div className="flex-1 text-left">
										<div className="text-xs font-medium text-destructive">
											Create document failed
										</div>
									</div>
								</div>
							</AccordionTrigger>
							<AccordionContent className="px-4">
								<div className="space-y-3 pt-3">
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
			const artifactId = (toolPart.output as { id?: string } | undefined)?.id;
			const isClickable = Boolean(artifactId && onArtifactClick);

			const handleClick = () => {
				if (artifactId && onArtifactClick) {
					onArtifactClick(artifactId);
				}
			};

			const cardBaseClasses = "flex w-full items-stretch transition-colors";
			const cardInteractionClasses = isClickable
				? "cursor-pointer hover:bg-muted/50"
				: "cursor-default";

			return (
				<div className="my-6 w-full overflow-hidden rounded-lg border">
					<button
						type="button"
						onClick={handleClick}
						disabled={!isClickable}
						className={`${cardBaseClasses} ${cardInteractionClasses}`}
					>
						<div className="flex-1 px-4 py-3 text-left">
							<div className="mb-1 text-xs font-medium text-foreground">
								{documentTitle ?? "New document"}
							</div>
							{documentKind ? (
								<div className="text-xs capitalize text-muted-foreground">
									{documentKind}
								</div>
							) : null}
						</div>
						<div className="flex w-32 items-center justify-center border-l bg-muted/30">
							<div className="flex h-6 w-6 items-center justify-center rounded bg-muted-foreground/20">
								<FileCode className="h-4 w-4 text-muted-foreground" />
							</div>
						</div>
					</button>
				</div>
			);
		}
		default:
			return null;
	}
});
