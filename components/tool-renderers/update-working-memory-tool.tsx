"use client";

import { AlertCircle, Brain, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { memo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { TaskWorkingMemory } from "@/mastra/lib/task-schema-v2";

export interface UpdateWorkingMemoryToolProps {
	toolPart: any;
}

export const UpdateWorkingMemoryTool = memo(function UpdateWorkingMemoryTool({
	toolPart,
}: UpdateWorkingMemoryToolProps) {
	const state = toolPart.state;
	const error = toolPart.errorText;
	const accordionValue = `working-memory-${toolPart.toolCallId}`;

	// Get memory data from input
	const memoryData = toolPart.input?.memory as TaskWorkingMemory | undefined;
	const tasks = memoryData?.tasks || [];
	const summary = memoryData?.summary;

	// Handle input-streaming state
	if (state === "input-streaming") {
		return (
			<div className="my-2 border rounded-lg px-4 py-3 bg-muted/30">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 animate-pulse text-purple-500" />
					<div className="text-sm">
						<div className="font-medium text-muted-foreground">Updating working memory...</div>
						{tasks.length > 0 && <p className="text-xs text-muted-foreground/70 mt-1">{tasks.length} tasks</p>}
					</div>
				</div>
			</div>
		);
	}

	// Handle error state
	if (state === "output-error") {
		return (
			<div className="my-2">
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<div className="font-medium">Working memory update failed</div>
						<p className="text-xs mt-2">{error || "Failed to update working memory"}</p>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	// Main accordion view (no border)
	return (
		<div className="my-6 w-full">
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value={accordionValue} className="border-0">
					<AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
						<div className="flex items-center gap-2 flex-1">
							{state === "input-available" ? (
								<Loader2 className="h-4 w-4 animate-spin text-purple-500" />
							) : state === "output-available" ? (
								<CheckCircle2 className="h-4 w-4 text-green-500" />
							) : (
								<Brain className="h-4 w-4 text-purple-500" />
							)}
							<div className="text-left flex-1">
								<div className="font-medium text-xs text-muted-foreground">We are updating memory</div>
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="px-4 pb-4">
						{/* Show summary */}
						<div className="pt-3">
							<p className="text-sm text-muted-foreground">{summary}</p>
						</div>

						{/* Loading state */}
						{state === "input-available" && (
							<div className="pt-3">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="h-3 w-3 animate-spin" />
									<span>Processing memory update...</span>
								</div>
							</div>
						)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
});
