"use client";

import { AlertCircle, Brain, CheckCircle2, ClipboardList, Loader2, Sparkles } from "lucide-react";
import { memo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export interface UpdateWorkingMemoryToolProps {
	toolPart: any;
}

interface Task {
	id: string;
	description: string;
	status: "active" | "in_progress" | "completed";
	priority: "high" | "medium" | "low";
	notes?: string;
	createdAt?: string;
	completedAt?: string;
}

interface WorkingMemory {
	tasks: Task[];
	summary?: string;
	lastUpdated?: string;
}

export const UpdateWorkingMemoryTool = memo(function UpdateWorkingMemoryTool({
	toolPart,
}: UpdateWorkingMemoryToolProps) {
	const state = toolPart.state;
	const error = toolPart.errorText;
	const accordionValue = `working-memory-${toolPart.toolCallId}`;

	// Get memory data from input
	const memoryData = toolPart.input?.memory as WorkingMemory | undefined;
	const tasks = memoryData?.tasks || [];
	const summary = memoryData?.summary;

	// Get status badge color
	const getStatusColor = (status: Task["status"]) => {
		switch (status) {
			case "completed":
				return "bg-green-500/10 text-green-700 border-green-500/20";
			case "in_progress":
				return "bg-blue-500/10 text-blue-700 border-blue-500/20";
			case "active":
				return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
			default:
				return "bg-gray-500/10 text-gray-700 border-gray-500/20";
		}
	};

	// Get priority badge color
	const getPriorityColor = (priority: Task["priority"]) => {
		switch (priority) {
			case "high":
				return "bg-red-500/10 text-red-700 border-red-500/20";
			case "medium":
				return "bg-orange-500/10 text-orange-700 border-orange-500/20";
			case "low":
				return "bg-gray-500/10 text-gray-700 border-gray-500/20";
			default:
				return "bg-gray-500/10 text-gray-700 border-gray-500/20";
		}
	};

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

	// Main accordion view
	return (
		<div className="my-6 border rounded-lg w-full">
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value={accordionValue}>
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
								<div className="font-medium text-xs text-muted-foreground">Working Memory Update</div>
								<div className="text-xs text-muted-foreground/70">
									{state === "input-available" ? "Updating..." : `${tasks.length} tasks`}
									{state === "output-available" && " • Updated successfully"}
								</div>
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="px-4 pb-4">
						{/* Summary section */}
						{summary && (
							<div className="pt-3">
								<h4 className="text-xs font-medium text-muted-foreground mb-2">Summary</h4>
								<p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">{summary}</p>
							</div>
						)}

						{/* Tasks section */}
						{tasks.length > 0 && (
							<div className="pt-3">
								<h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
									<ClipboardList className="h-3 w-3" />
									Tasks ({tasks.length})
								</h4>
								<div className="space-y-2">
									{tasks.map((task) => (
										<div key={task.id} className="bg-muted/30 rounded-md p-3 border border-muted-foreground/10">
											<div className="flex items-start justify-between gap-2 mb-1">
												<div className="flex items-center gap-2">
													<code className="text-xs font-mono text-muted-foreground">{task.id}</code>
													<Badge variant="outline" className={`text-xs px-1.5 py-0 ${getStatusColor(task.status)}`}>
														{task.status.replace("_", " ")}
													</Badge>
													<Badge variant="outline" className={`text-xs px-1.5 py-0 ${getPriorityColor(task.priority)}`}>
														{task.priority}
													</Badge>
												</div>
											</div>
											<p className="text-sm text-foreground/90 mt-1">{task.description}</p>
											{task.notes && <p className="text-xs text-muted-foreground mt-2 italic">{task.notes}</p>}
											<div className="flex gap-4 mt-2 text-xs text-muted-foreground/60">
												{task.createdAt && <span>Created: {new Date(task.createdAt).toLocaleString()}</span>}
												{task.completedAt && <span>Completed: {new Date(task.completedAt).toLocaleString()}</span>}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Raw JSON view (collapsed by default) */}
						<details className="mt-4">
							<summary className="text-xs text-muted-foreground cursor-pointer hover:text-muted-foreground/80">
								View raw data
							</summary>
							<div className="mt-2 bg-muted/50 rounded-md p-3 overflow-x-auto">
								<pre className="text-xs font-mono whitespace-pre">{JSON.stringify(memoryData, null, 2)}</pre>
							</div>
						</details>

						{/* Loading state */}
						{state === "input-available" && (
							<div className="pt-3">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="h-3 w-3 animate-spin" />
									<span>Updating working memory...</span>
								</div>
							</div>
						)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
});
