"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import {
	AlertCircle,
	FileCode,
	Loader2,
} from "lucide-react";
import { memo } from "react";
import type { CreateDocumentToolUIPart } from "~/ai/lightfast-app-chat-ui-messages";

export interface CreateDocumentToolProps {
	toolPart: CreateDocumentToolUIPart;
	onArtifactClick?: (artifactId: string) => void;
}

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

	// Handle output-error state - this is the only different UI
	if (toolPart.state === "output-error") {
		return (
			<div className="my-2">
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<div className="font-medium">Create Document failed</div>
						{documentTitle && (
							<p className="text-xs mt-1 opacity-80">
								Title: "{documentTitle}"
							</p>
						)}
						<p className="text-xs mt-2">
							{toolPart.errorText || "An error occurred while creating document"}
						</p>
					</AlertDescription>
				</Alert>
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