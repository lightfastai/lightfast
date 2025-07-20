"use client";

import { memo, useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { ExperimentalAgentTaskUnion } from "@/mastra/agents/experimental";

interface TaskAccordionProps {
	tasks: ExperimentalAgentTaskUnion[];
	className?: string;
}

// Status styling configuration with support for different agent status types
const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
	active: {
		bg: "bg-blue-50 dark:bg-blue-950/30",
		text: "text-blue-700 dark:text-blue-300",
		border: "border-blue-200 dark:border-blue-800",
	},
	in_progress: {
		bg: "bg-yellow-50 dark:bg-yellow-950/30",
		text: "text-yellow-700 dark:text-yellow-300",
		border: "border-yellow-200 dark:border-yellow-800",
	},
	completed: {
		bg: "bg-green-50 dark:bg-green-950/30",
		text: "text-green-700 dark:text-green-300",
		border: "border-green-200 dark:border-green-800",
	},
	pending: {
		bg: "bg-gray-50 dark:bg-gray-950/30",
		text: "text-gray-700 dark:text-gray-300",
		border: "border-gray-200 dark:border-gray-800",
	},
	failed: {
		bg: "bg-red-50 dark:bg-red-950/30",
		text: "text-red-700 dark:text-red-300",
		border: "border-red-200 dark:border-red-800",
	},
};

// Default style for unknown statuses
const defaultStatusStyle = {
	bg: "bg-gray-50 dark:bg-gray-950/30",
	text: "text-gray-700 dark:text-gray-300",
	border: "border-gray-200 dark:border-gray-800",
};

const priorityLabels = {
	high: "High",
	medium: "Medium",
	low: "Low",
};

function TaskAccordionComponent({ tasks, className }: TaskAccordionProps) {
	// Group tasks by status dynamically
	const groupedTasks = useMemo(() => {
		const groups: Record<string, ExperimentalAgentTaskUnion[]> = {};

		tasks.forEach((task) => {
			if (!groups[task.status]) {
				groups[task.status] = [];
			}
			groups[task.status].push(task);
		});

		return groups;
	}, [tasks]);

	// Count tasks by status
	const taskCounts = useMemo(
		() => {
			const counts: Record<string, number> = { total: tasks.length };
			Object.entries(groupedTasks).forEach(([status, taskList]) => {
				counts[status] = taskList.length;
			});
			return counts;
		}),
		[groupedTasks, tasks.length],
	);

	console.log(`[TaskAccordion] Rendering with ${tasks.length} tasks:`, tasks);

	return (
		<div className={cn("w-full max-w-3xl mx-auto mb-2", className)}>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value="tasks" className="border rounded-lg bg-background/50 backdrop-blur-sm">
					<AccordionTrigger className="px-4 py-3 hover:no-underline">
						<div className="flex items-center justify-between w-full">
							<span className="text-sm font-medium">Tasks</span>
							<div className="flex items-center gap-4 mr-2">
								{Object.entries(taskCounts)
									.filter(([status, count]) => status !== "total" && count > 0)
									.map(([status, count]) => {
										const style = statusStyles[status] || defaultStatusStyle;
										return (
											<span key={status} className={cn("text-xs", style.text)}>
												{count} {status.replace("_", " ")}
											</span>
										);
									})}
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="px-4 pb-4">
						{tasks.length === 0 ? (
							<div className="text-center py-4">
								<p className="text-sm text-muted-foreground">
									No tasks yet. Start a conversation to see tasks appear here.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{/* Render task groups in priority order */}
								{["in_progress", "active", "pending", "failed", "completed"]
									.filter(status => groupedTasks[status]?.length > 0)
									.map(status => (
										<div key={status}>
											<h4 className="text-xs font-semibold text-muted-foreground mb-2">
												{status.toUpperCase().replace("_", " ")}
											</h4>
											<div className="space-y-2">
												{groupedTasks[status].map((task) => (
													<TaskItem key={task.id} task={task} />
												))}
											</div>
										</div>
									))}
								
								{/* Other statuses not in priority list */}
								{Object.entries(groupedTasks)
									.filter(([status]) => !["in_progress", "active", "pending", "failed", "completed"].includes(status))
									.map(([status, statusTasks]) => (
										<div key={status}>
											<h4 className="text-xs font-semibold text-muted-foreground mb-2">
												{status.toUpperCase().replace("_", " ")}
											</h4>
											<div className="space-y-2">
												{statusTasks.map((task) => (
													<TaskItem key={task.id} task={task} />
												))}
											</div>
										</div>
									))}
							</div>
						)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}

function TaskItem({ task }: { task: ExperimentalAgentTaskUnion }) {
	const styles = statusStyles[task.status] || defaultStatusStyle;

	return (
		<div className={cn("p-3 rounded-md border", styles.bg, styles.border)}>
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<p className={cn("text-sm break-words", styles.text)}>{task.description}</p>
					{task.notes && <p className="text-xs text-muted-foreground mt-1">{task.notes}</p>}
				</div>
				<div className="flex items-center gap-2 flex-shrink-0">
					<span className={cn("text-xs px-2 py-0.5 rounded-full", styles.bg, styles.text, styles.border, "border")}>
						{priorityLabels[task.priority]}
					</span>
				</div>
			</div>
			<div className="flex items-center gap-4 mt-2">
				<span className="text-xs text-muted-foreground">{task.id}</span>
				{task.completedAt && (
					<span className="text-xs text-muted-foreground">
						Completed: {new Date(task.completedAt).toLocaleTimeString()}
					</span>
				)}
			</div>
		</div>
	);
}

export const TaskAccordion = memo(TaskAccordionComponent);
