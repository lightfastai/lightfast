import { useEffect, useState } from "react";
import type { Task } from "@/mastra/agents/types/task";

interface UseAgentTasksOptions {
	threadId: string;
	agentId?: string;
	pollingInterval?: number;
}

export function useAgentTasks({ threadId, agentId, pollingInterval = 5000 }: UseAgentTasksOptions) {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let intervalId: NodeJS.Timeout;

		async function fetchTasks() {
			try {
				console.log(`[TASKS] Fetching tasks for thread: ${threadId}`);
				const apiEndpoint = agentId ? `/api/chat/${agentId}/thread/${threadId}/memory` : `/api/chat/thread/${threadId}/memory`;
				const response = await fetch(apiEndpoint);
				if (!response.ok) {
					throw new Error("Failed to fetch tasks");
				}

				const data = await response.json();
				console.log(`[TASKS] Memory API response:`, data);

				// Extract tasks from the working memory
				if (data.workingMemory?.tasks) {
					console.log(`[TASKS] Found ${data.workingMemory.tasks.length} tasks`);
					setTasks(data.workingMemory.tasks);
				} else {
					console.log(`[TASKS] No tasks found in working memory`);
					setTasks([]);
				}
				setError(null);
			} catch (err) {
				console.error("Error fetching tasks:", err);
				setError(err instanceof Error ? err.message : "Failed to fetch tasks");
			} finally {
				setIsLoading(false);
			}
		}

		// Initial fetch
		fetchTasks();

		// Set up polling
		intervalId = setInterval(fetchTasks, pollingInterval);

		return () => {
			clearInterval(intervalId);
		};
	}, [threadId, agentId, pollingInterval]);

	return { tasks, isLoading, error };
}
