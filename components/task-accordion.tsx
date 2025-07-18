"use client";

import { memo, useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { Task, TaskStatusType } from "@/mastra/lib/task-schema";

interface TaskAccordionProps {
	tasks: Task[];
	className?: string;
}

// Status styling configuration
const statusStyles: Record<TaskStatusType, { bg: string; text: string; border: string }> = {
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
};

const priorityLabels = {
	high: "High",
	medium: "Medium",
	low: "Low",
};

function TaskAccordionComponent({ tasks, className }: TaskAccordionProps) {
	// Group tasks by status
	const groupedTasks = useMemo(() => {
		const groups = {
			active: [] as Task[],
			in_progress: [] as Task[],
			completed: [] as Task[],
		};

		tasks.forEach((task) => {
			groups[task.status].push(task);
		});

		return groups;
	}, [tasks]);

	// Count tasks by status
	const taskCounts = useMemo(
		() => ({
			active: groupedTasks.active.length,
			in_progress: groupedTasks.in_progress.length,
			completed: groupedTasks.completed.length,
			total: tasks.length,
		}),
		[groupedTasks, tasks.length],
	);

	console.log(`[TaskAccordion] Rendering with ${tasks.length} tasks:`, tasks);
	
	if (tasks.length === 0) {
		console.log(`[TaskAccordion] No tasks, returning null`);
		return null;
	}

	return (
		<div className={cn("w-full max-w-3xl mx-auto mb-2", className)}>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value="tasks" className="border rounded-lg bg-background/50 backdrop-blur-sm">
					<AccordionTrigger className="px-4 py-3 hover:no-underline">
						<div className="flex items-center justify-between w-full">
							<span className="text-sm font-medium">Tasks</span>
							<div className="flex items-center gap-4 mr-2">
								{taskCounts.active > 0 && (
									<span className="text-xs text-blue-600 dark:text-blue-400">{taskCounts.active} active</span>
								)}
								{taskCounts.in_progress > 0 && (
									<span className="text-xs text-yellow-600 dark:text-yellow-400">
										{taskCounts.in_progress} in progress
									</span>
								)}
								{taskCounts.completed > 0 && (
									<span className="text-xs text-green-600 dark:text-green-400">{taskCounts.completed} completed</span>
								)}
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="px-4 pb-4">
						<div className="space-y-3">
							{/* In Progress Tasks */}
							{groupedTasks.in_progress.length > 0 && (
								<div>
									<h4 className="text-xs font-semibold text-muted-foreground mb-2">IN PROGRESS</h4>
									<div className="space-y-2">
										{groupedTasks.in_progress.map((task) => (
											<TaskItem key={task.id} task={task} />
										))}
									</div>
								</div>
							)}

							{/* Active Tasks */}
							{groupedTasks.active.length > 0 && (
								<div>
									<h4 className="text-xs font-semibold text-muted-foreground mb-2">ACTIVE</h4>
									<div className="space-y-2">
										{groupedTasks.active.map((task) => (
											<TaskItem key={task.id} task={task} />
										))}
									</div>
								</div>
							)}

							{/* Completed Tasks */}
							{groupedTasks.completed.length > 0 && (
								<div>
									<h4 className="text-xs font-semibold text-muted-foreground mb-2">COMPLETED</h4>
									<div className="space-y-2">
										{groupedTasks.completed.map((task) => (
											<TaskItem key={task.id} task={task} />
										))}
									</div>
								</div>
							)}
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}

function TaskItem({ task }: { task: Task }) {
	const styles = statusStyles[task.status];

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
